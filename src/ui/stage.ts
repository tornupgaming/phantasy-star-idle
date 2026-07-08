/**
 * PSIV-style battle stage (battle-scene-view D3/D4) — the run screen's live
 * renderer. The shell DOM (ticker / enemy field / player window / log) is built
 * once by the StageIsland (islands.tsx); this class owns every dynamic update. A rAF
 * loop recomputes game time from the engine each frame (via game.runProgress(),
 * so it can never drift) and plays each newly crossed event at its timestamp:
 * hit flashes, floating damage numbers, HP bar tweens, ticker + log lines.
 *
 * Catch-up (first mount, mid-run reload, tab refocus after throttling) folds the
 * backlog through the pure scene reducer silently and repaints — no replaying
 * missed time. The 1 Hz poll in main.ts remains the settle authority; when the
 * run disappears the loop stops and the regime switch disposes the island.
 */

import type { Game } from "../engine/game";
import type { RunEvent } from "../engine/run";
import { effectiveStats } from "../engine/character";
import { CONSUMABLES_LIST } from "../engine/consumables";
import { getArea } from "../engine/content";
import { layoutRooms, type GeometryRoom } from "../engine/data/room-geometry";
import { createScene, applyEvent, type Scene } from "./scene";
import { minimapCells } from "./minimap";
import { enemyArtUrl } from "./enemy-art";
import damageFontUrl from "./assets/damage-font.png";
import damageFont from "./assets/damage-font.json";

/** More new events than this in one frame → silent catch-up instead of effects. */
const CATCHUP_BATCH = 8;

// PSO bitmap glyph atlas for floating combat text (see scripts/
// extract-damage-font.py). Tints are baked into the PNG as rows; until the
// image loads (or if it never does) floats fall back to plain text.
type FloatTint = keyof typeof damageFont.tintY;
const FLOAT_GLYPHS: Record<string, { x: number; w: number }> = damageFont.glyphs;
let damageFontReady = false;
if (typeof Image !== "undefined") {
  const img = new Image();
  img.onload = () => (damageFontReady = true);
  img.src = damageFontUrl;
}

function floatGlyph(ch: string, tint: FloatTint, scale: number): HTMLElement | null {
  const g = FLOAT_GLYPHS[ch];
  if (!g) return null;
  const s = document.createElement("span");
  s.className = "float-glyph";
  s.style.width = `${g.w * scale}px`;
  s.style.height = `${damageFont.cellHeight * scale}px`;
  s.style.backgroundImage = `url(${damageFontUrl})`;
  s.style.backgroundSize = `${damageFont.width * scale}px ${damageFont.height * scale}px`;
  s.style.backgroundPosition = `${-g.x * scale}px ${-damageFont.tintY[tint] * scale}px`;
  return s;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function logClass(e: RunEvent): string {
  if (e.kind === "attack") {
    if (!e.attack?.hit) return "l-miss";
    if (e.attack.crit) return "l-crit";
    return "l-attack";
  }
  if (e.kind === "sidestep") return "l-miss"; // muted styling, same as a miss (design D3)
  return `l-${e.kind}`;
}

export class BattleStage {
  private scene: Scene;
  private played = 0; // events already applied to the scene
  private raf = 0;
  private running = false;
  private logAtBottom = true;
  // Minimap plan, fixed for the whole run at mount (plan-level, outcome-blind):
  // the rolled layout's room geometry and each planned room's authentic room id.
  private geometry: GeometryRoom[] | null = null;
  private authRoomPlan: (number | null)[] = [];

  constructor(
    private root: HTMLElement,
    private game: Game,
  ) {
    const input = game.state.activeRun!.input;
    this.scene = createScene(effectiveStats(input.character).hp, input.supply);
    const prog = game.runProgress();
    if (prog?.layoutKey) {
      const area = getArea(input.areaId);
      this.geometry = layoutRooms(area.episode, area.floor, prog.layoutKey);
      this.authRoomPlan = prog.authRoomPlan;
    }
  }

  private q<T extends HTMLElement>(sel: string): T {
    const el = this.root.querySelector<T>(sel);
    if (!el) throw new Error(`stage element missing: ${sel}`);
    return el;
  }

  /** Initial synchronous paint (catch-up fold), then start the frame loop. */
  start(): void {
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (): void => {
    if (!this.running) return;
    if (!this.root.querySelector(".stage-field")) {
      // Shell is gone (screen replaced or page torn down) — stop quietly.
      this.stop();
      return;
    }
    const prog = this.game.runProgress();
    if (!prog) {
      // Run settled; main.ts's next render tears the stage down.
      this.stop();
      return;
    }

    const revealed = prog.revealedEvents;
    const fresh = revealed.length - this.played;
    if (this.played === 0 || fresh > CATCHUP_BATCH) {
      // First paint or a backlog (reload/refocus): fold silently, repaint fully.
      for (let i = this.played; i < revealed.length; i++) applyEvent(this.scene, revealed[i]);
      if (revealed.length > 0) {
        this.appendLog(revealed.slice(this.played));
        this.setTicker(revealed[revealed.length - 1]);
      }
      this.played = revealed.length;
      this.repaintAll();
    } else if (fresh > 0) {
      for (let i = this.played; i < revealed.length; i++) this.playEvent(revealed[i]);
      this.played = revealed.length;
    }

    this.q(".stage-pct").textContent =
      `Room ${Math.max(0, this.scene.roomIndex + 1)}/${prog.totalRooms}`;
    this.updateLootTally();

    this.raf = requestAnimationFrame(this.tick);
  };

  // ---- Event playback (animated path) --------------------------------------

  private playEvent(e: RunEvent): void {
    applyEvent(this.scene, e);
    this.setTicker(e);
    this.appendLog([e]);

    switch (e.kind) {
      case "room":
        this.rebuildField();
        this.updateMinimap();
        this.updatePlayer();
        break;
      case "spawn":
        this.appendSpawnedEnemy(e.spawn?.enemyIndex ?? -1);
        break;
      case "attack": {
        const a = e.attack;
        if (!a) break;
        if (a.actor === "char") {
          const el = this.enemyEl(a.targetIndex ?? -1);
          if (!el) break;
          if (a.hit) {
            this.flash(el, "hit");
            this.float(el, `${a.damage}`, a.crit ? "float-dmg crit" : "float-dmg");
            this.updateEnemyHp(a.targetIndex!, el);
          } else {
            this.float(el, "MISS", "float-miss");
          }
        } else {
          const box = this.q(".player-hud");
          if (a.hit) {
            this.flash(box, "hurt");
            this.float(box, `${a.damage}`, a.crit ? "float-dmg crit" : "float-dmg");
            this.updatePlayer();
          } else {
            this.float(box, "MISS", "float-miss");
          }
        }
        break;
      }
      case "sidestep":
        // The character moved, not the enemy missing (design D3) — a distinct
        // evade indicator on the character, no health-bar change.
        this.float(this.q(".player-hud"), "SIDESTEP", "float-sidestep");
        break;
      case "kill": {
        const el = this.enemyEl(e.kill?.enemyIndex ?? -1);
        if (el) el.classList.add("dead");
        this.bumpKills();
        break;
      }
      case "heal":
      case "revive":
        this.flash(this.q(".player-hud"), "healed");
        this.updatePlayer();
        break;
      case "complete":
      case "eject":
        this.updateMinimap();
        this.updateStatus();
        break;
    }
  }

  // ---- Painting -------------------------------------------------------------

  private repaintAll(): void {
    this.rebuildField();
    this.updateMinimap();
    this.updatePlayer();
    this.updateStatus();
    // Re-mark dead enemies and kill counter after a silent fold.
    this.bumpKills();
  }

  private rebuildField(): void {
    const field = this.q(".stage-field");
    if (this.scene.enemies.length === 0) {
      field.innerHTML = `<div class="stage-empty muted">${
        this.scene.roomIndex < 0 ? "Heading into the area…" : "Room clear — opening boxes…"
      }</div>`;
      return;
    }
    field.innerHTML = this.scene.enemies.map((en, i) => this.enemyHtml(en, i)).join("");
  }

  private enemyHtml(en: Scene["enemies"][number], i: number): string {
    const art = enemyArtUrl(en.name, en.id);
    return `
      <div class="stage-enemy${en.dead ? " dead" : ""}" data-enemy-id="${esc(en.id)}" data-index="${i}">
        <div class="stage-enemy-box">${
          art ? `<img class="stage-enemy-sprite" src="${art}" alt="" draggable="false">` : ""
        }</div>
        <div class="stage-enemy-name">${esc(en.name)}</div>
        <div class="hpbar hp-enemy"><span style="width:${(en.hp / en.maxHp) * 100}%"></span></div>
        <div class="stage-enemy-hp muted">${en.hp}/${en.maxHp}</div>
      </div>`;
  }

  private appendSpawnedEnemy(index: number): void {
    const en = this.scene.enemies[index];
    if (!en) return;
    const field = this.q(".stage-field");
    const empty = field.querySelector(".stage-empty");
    if (empty) field.innerHTML = "";
    field.insertAdjacentHTML("beforeend", this.enemyHtml(en, index));
  }

  private enemyEl(index: number): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(`.stage-enemy[data-index="${index}"]`);
  }

  private updateEnemyHp(index: number, el: HTMLElement): void {
    const en = this.scene.enemies[index];
    if (!en) return;
    const bar = el.querySelector<HTMLElement>(".hpbar > span");
    if (bar) bar.style.width = `${(en.hp / en.maxHp) * 100}%`;
    const label = el.querySelector<HTMLElement>(".stage-enemy-hp");
    if (label) label.textContent = `${en.hp}/${en.maxHp}`;
  }

  private updatePlayer(): void {
    const s = this.scene;
    const pctHp = s.charMaxHp > 0 ? (s.charHp / s.charMaxHp) * 100 : 0;
    const bar = this.q(".stage-char-hp");
    bar.style.width = `${pctHp}%`;
    bar.classList.toggle("low", pctHp <= 30);
    // The capsule carries the static `HP` label; this element is numbers only.
    this.q(".stage-char-hp-text").textContent = `${s.charHp}/${s.charMaxHp}`;
    const parts = CONSUMABLES_LIST.filter((c) => (s.supply[c.id] ?? 0) > 0).map(
      (c) => `${c.name} ×${s.supply[c.id]}`,
    );
    this.q(".stage-supply").textContent = parts.length ? parts.join(" · ") : "no consumables left";
  }

  private updateMinimap(): void {
    // Spatial floor map (battle-minimap spec): every geometry room renders
    // from the first frame; states come from the folded scene only (the
    // plan-level inputs were fixed at mount — no outcome oracle to read).
    const host = this.q(".stage-minimap");
    const s = this.scene;
    const done = s.phase === "complete" || s.phase === "ejected";
    if (!this.geometry) {
      // Boss arenas have no extracted geometry — the numeric readout carries.
      host.innerHTML = "";
      if (done) this.updateStatus();
      return;
    }

    // Aspect-fit the floor's x/z extents into the available box (z up).
    const PAD = 12;
    const MAX_H = 150;
    const xs = this.geometry.map((r) => r.x);
    const zs = this.geometry.map((r) => r.z);
    const minX = Math.min(...xs);
    const maxZ = Math.max(...zs);
    const dx = Math.max(1, Math.max(...xs) - minX);
    const dz = Math.max(1, maxZ - Math.min(...zs));
    const hostW = Math.max(120, host.clientWidth || 600);
    const scale = Math.min((hostW - PAD * 2) / dx, (MAX_H - PAD * 2) / dz);
    host.style.height = `${Math.ceil(dz * scale + PAD * 2)}px`;
    const xPad = (hostW - dx * scale) / 2; // center a narrow floor in the box

    const cells = minimapCells(this.geometry, this.authRoomPlan, s);
    host.innerHTML = cells
      .map((c) => {
        const left = (c.x - minX) * scale + xPad;
        const top = (maxZ - c.z) * scale + PAD;
        return `<div class="minimap-room ${c.state}" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px"></div>`;
      })
      .join("");
    if (done) this.updateStatus();
  }

  private updateStatus(): void {
    const el = this.q(".stage-status");
    if (this.scene.phase === "complete") {
      el.textContent = "Cleared — settling…";
      el.className = "stage-status outcome-complete";
    } else if (this.scene.phase === "ejected") {
      el.textContent = "Ejected — settling…";
      el.className = "stage-status outcome-ejected";
    } else {
      el.textContent = "Running…";
      el.className = "stage-status muted";
    }
  }

  private bumpKills(): void {
    // Cheap and always-correct: count kill events already played.
    const prog = this.game.runProgress();
    if (!prog) return;
    const kills = prog.revealedEvents.filter((e) => e.kind === "kill").length;
    this.q(".stage-kills").textContent = `${kills}`;
  }

  private updateLootTally(): void {
    const prog = this.game.runProgress();
    if (!prog) return;
    const tally = new Map<string, { name: string; count: number; sold: boolean }>();
    for (const e of prog.revealedEvents) {
      if (e.kind !== "loot" || e.loot?.source !== "enemy") continue;
      const name = e.loot.kind === "meseta" ? "meseta" : e.loot.name;
      const key = `${name}\u0000${e.loot.sold ? "sold" : "kept"}`;
      const row = tally.get(key) ?? { name, count: 0, sold: !!e.loot.sold };
      row.count += e.loot.count;
      tally.set(key, row);
    }

    const el = this.q(".stage-loot-tally");
    if (tally.size === 0) {
      el.classList.add("muted");
      el.textContent = "No enemy drops yet.";
      return;
    }

    el.classList.remove("muted");
    el.replaceChildren(
      ...[...tally.values()].map((row) => {
        const chip = document.createElement("span");
        chip.className = "loot-chip";
        const count = row.name === "meseta" ? row.count : `×${row.count}`;
        chip.textContent = `${row.name} ${count}${row.sold ? " (sold)" : ""}`;
        return chip;
      }),
    );
  }

  // ---- Effects ---------------------------------------------------------------

  /** Restartable one-shot animation class. */
  private flash(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }

  private float(host: HTMLElement, text: string, cls: string): void {
    const span = document.createElement("span");
    span.className = cls;
    // Multi-hit swings land several floats on one host within the animation's
    // lifetime; fan them out (alternating sides, stepping down) or they pile
    // up illegibly at the shared anchor. The rise animation owns `transform`,
    // so the stagger goes through left/top instead.
    const active = host.querySelectorAll(".float-dmg, .float-miss, .float-sidestep").length;
    if (active > 0) {
      const dx = (active % 2 ? -1 : 1) * Math.min(Math.ceil(active / 2) * 16, 48);
      span.style.left = `calc(50% + ${dx}px)`;
      span.style.top = `${4 + Math.min(active, 4) * 10}px`;
    }
    if (damageFontReady) {
      const tint: FloatTint = cls.includes("miss") ? "red" : cls.includes("crit") ? "gold" : "white";
      const scale = cls.includes("crit") ? 3 : 2;
      for (const ch of text) {
        const glyph = floatGlyph(ch, tint, scale);
        if (glyph) span.appendChild(glyph);
      }
    }
    if (!span.firstChild) span.textContent = text; // atlas not loaded → plain text
    host.appendChild(span);
    span.addEventListener("animationend", () => span.remove());
  }

  private setTicker(e: RunEvent): void {
    const ticker = this.q(".stage-ticker");
    ticker.textContent = e.text;
    ticker.className = `stage-ticker ${logClass(e)}`;
  }

  private appendLog(events: RunEvent[]): void {
    const log = this.q(".stage-log");
    this.logAtBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;
    const frag = document.createDocumentFragment();
    for (const e of events) {
      const div = document.createElement("div");
      div.className = logClass(e);
      div.textContent = e.text;
      frag.appendChild(div);
    }
    log.appendChild(frag);
    if (this.logAtBottom) log.scrollTop = log.scrollHeight;
  }
}
