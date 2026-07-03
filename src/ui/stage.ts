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
import { createScene, applyEvent, type Scene } from "./scene";
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
  return `l-${e.kind}`;
}

export class BattleStage {
  private scene: Scene;
  private played = 0; // events already applied to the scene
  private raf = 0;
  private running = false;
  private logAtBottom = true;

  constructor(
    private root: HTMLElement,
    private game: Game,
  ) {
    const input = game.state.activeRun!.input;
    this.scene = createScene(effectiveStats(input.character).hp, input.supply);
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

    const pct = Math.min(100, Math.round((prog.gameTime / Math.max(1, prog.endTime)) * 100));
    this.q(".stage-progress").style.width = `${pct}%`;
    this.q(".stage-pct").textContent = `${pct}%`;

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
        this.updateRooms();
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
        this.updateRooms();
        this.updateStatus();
        break;
    }
  }

  // ---- Painting -------------------------------------------------------------

  private repaintAll(): void {
    this.rebuildField();
    this.updateRooms();
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
    this.q(".stage-room-label").textContent =
      s.roomIndex >= 0 ? `Room ${s.roomIndex + 1}/${s.totalRooms}` : "—";
    const parts = CONSUMABLES_LIST.filter((c) => (s.supply[c.id] ?? 0) > 0).map(
      (c) => `${c.name} ×${s.supply[c.id]}`,
    );
    this.q(".stage-supply").textContent = parts.length ? parts.join(" · ") : "no consumables left";
  }

  private updateRooms(): void {
    const roomPlan = this.game.runProgress()?.roomPlan ?? [];
    const s = this.scene;
    const done = s.phase === "complete" || s.phase === "ejected";
    this.q(".stage-rooms").innerHTML = roomPlan
      .map((room, i) => {
        const cls =
          i < s.roomIndex || (done && s.phase === "complete")
            ? "cleared"
            : i === s.roomIndex && !done
              ? "current"
              : "";
        return `<div class="room-cell ${cls}">R${i + 1}<br><span class="muted">${room.enemies}👾 ${room.boxes}📦</span></div>`;
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
    if (damageFontReady) {
      const tint: FloatTint = cls.includes("miss") ? "red" : cls.includes("crit") ? "gold" : "white";
      const scale = cls.includes("crit") ? 2 : 1;
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
