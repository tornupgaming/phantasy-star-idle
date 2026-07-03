/**
 * Meta-layer UI — vanilla DOM over the Game engine (design D10), restructured
 * around a PSO BB-style screen flow (pso-ui-overhaul):
 *
 *   character select → (create) → Pioneer 2 hub (HUD over a scene)
 *
 * The hub (pso-hud-menus) is a HUD shell: a persistent scene layer (canvas
 * glyph-wall backdrop, per-pane themes) under floating corner-anchored windows
 * — status cluster, money pod, nav window, pane window(s), detail window, and
 * a shopkeeper dialogue window along the bottom. The root splits into a
 * persistent `.scene-layer` (owned by the Backdrop, survives re-renders) and a
 * re-rendered `.ui-layer` (windows). The router is UI-local state (D1): never
 * persisted, boots to character select, and an active run overrides
 * everything; entering the hub always lands on the Guild pane. The run screen
 * is a persistent shell whose dynamic parts are owned by the BattleStage
 * (battle-scene-view D3): render() mounts the shell once and skips rebuilds
 * while the stage is live, so its animations survive. When a run settles the
 * router is forced back to the hub and the report shows as a dialog over the
 * Guild pane (D2).
 */

import type { Game } from "../engine/game";
import { AREA_LIST } from "../engine/content";
import { BattleStage } from "./stage";
import { Backdrop } from "./backdrop";
import { DIFFICULTIES, type DifficultyId } from "../engine/areas";
import {
  effectiveStats,
  equipmentAtp,
  previewEquipment,
  unitCapacity,
  type Character,
} from "../engine/character";
import { CLASSES, CLASS_BY_ID, SECTION_IDS, LEVEL_CAP, type SectionId } from "../engine/classes";
import { sectionIdFromName, xpForLevel } from "../engine/progression";
import { itemSellValue, isUnit, type Item } from "../engine/items";
import { GRINDER_PRICE, gearPrice, type ShopKind } from "../engine/shop";
import type { AttackType } from "../engine/combat";
import { CONSUMABLES_LIST, type Supply } from "../engine/consumables";
import { icon, iconForKind, spriteDefs, type IconId } from "./icons";
import {
  failureLine,
  flavor,
  greeting,
  itemFlavor,
  reaction,
  type DialoguePane,
  type ReactionId,
} from "./dialogue";

type Screen = "select" | "create" | "hub";

/** Hub detail panes, one per nav entry (Change Character is navigation). */
type Pane = "guild" | "weapon-shop" | "armour-shop" | "tool-shop" | "equipment" | "bank";

const PANE_LABELS: Record<Pane, string> = {
  guild: "Hunter's Guild",
  "weapon-shop": "Weapon Shop",
  "armour-shop": "Armour Shop",
  "tool-shop": "Tool Shop",
  equipment: "Equipment",
  bank: "Inventory/Bank",
};

/** Equipment-pane slot selector; "units" covers the frame's unit mounts. */
type EquipSlot = "weapon" | "frame" | "barrier" | "units";

const SLOT_ICONS: Record<EquipSlot, IconId> = {
  weapon: "saber",
  frame: "frame",
  barrier: "barrier",
  units: "unit",
};

/** BB's canonical class-select order (engine order appends the later classes). */
const CLASS_ORDER = [
  "humar", "hunewearl", "hucast", "hucaseal",
  "ramar", "ramarl", "racast", "racaseal",
  "fomar", "fomarl", "fonewm", "fonewearl",
];
const CLASSES_CANONICAL = [...CLASSES].sort(
  (a, b) => CLASS_ORDER.indexOf(a.id) - CLASS_ORDER.indexOf(b.id),
);

const PATTERN_PRESETS: Record<string, AttackType[]> = {
  "Balanced": ["normal", "normal", "heavy"],
  "Aggressive": ["heavy", "heavy", "heavy"],
  "Steady": ["normal", "normal", "normal"],
  "Quick": ["normal", "heavy"],
};

function patternMeta(pattern: AttackType[]): string {
  return pattern.map((t) => t[0].toUpperCase()).join("-");
}

function patternName(pattern: AttackType[]): string {
  for (const [name, p] of Object.entries(PATTERN_PRESETS)) {
    if (p.length === pattern.length && p.every((x, i) => x === pattern[i])) return name;
  }
  return patternMeta(pattern);
}

function supplyLine(supply: Supply): string {
  const parts = CONSUMABLES_LIST.filter((c) => (supply[c.id] ?? 0) > 0).map(
    (c) => `${c.name} ×${supply[c.id]}`,
  );
  return parts.length ? parts.join(", ") : "—";
}

function itemMeta(item: Item): string {
  return item.kind === "weapon"
    ? `wpn · ATP ${item.minAtp}+${item.spread} · ${Math.round(item.attribute * 100)}% · +${item.grind}/${item.maxGrind}`
    : item.kind === "frame"
      ? `frame · DFP ${item.dfp} EVP ${item.evp} · ${item.unitSlots} slots`
      : item.kind === "barrier"
        ? `barrier · DFP ${item.dfp} EVP ${item.evp}`
        : `unit · ${Object.entries(item.bonus)
            .map(([k, v]) => `${k}+${v}`)
            .join(" ")}`;
}

function xpLine(classId: string, level: number, xp: number): string {
  if (level >= LEVEL_CAP) return `XP ${xp} · max level`;
  const next = xpForLevel(classId, level + 1);
  return `XP ${xp} · ${next - xp} to Lv ${level + 1}`;
}

/**
 * A named HUD window: orange tab header (title + optional trailing meta)
 * overlapping a pso-window body (pso-visual-theme "tab header" requirement).
 */
function windowBox(title: string, body: string, trailing = ""): string {
  return `<section class="pso-window win">
    <div class="pso-tab"><span class="tab-title">${title}</span>${
      trailing ? `<span class="tab-meta">${trailing}</span>` : ""
    }</div>
    <div class="win-body">${body}</div>
  </section>`;
}

export class UI {
  private notice = "";
  private stage: BattleStage | null = null;
  private backdrop: Backdrop | null = null;
  private sceneEl: HTMLElement | null = null;
  private uiEl: HTMLElement | null = null;

  // Screen router (D1) — UI-local, never persisted; boots to character select.
  private screen: Screen = "select";
  // Hub pane (pioneer2-hub-redesign D1); every hub entry lands on the Guild.
  private pane: Pane = "guild";
  // list+detail highlight for shop/bank panes; reset on navigation.
  private detailId: string | null = null;
  // Equipment pane: selected slot + highlighted candidate. Candidate ids are an
  // inventory item id, "remove" (empty the single slot), or "remove:<unitId>".
  private equipSlot: EquipSlot = "weapon";
  private equipCand: string | null = null;
  private reportDismissed = false;
  // Create-screen draft (survives re-renders while picking a class).
  private createClassId = CLASSES[0].id;
  private createName = "";
  private createSid: SectionId | "" = "";
  // Guild counter selections, kept across hub re-renders.
  private areaSel = AREA_LIST[0].id;
  private diffSel = Object.keys(DIFFICULTIES)[0] as DifficultyId;

  // Dialogue state (shop-dialogue): current line + typewriter progress. The
  // line survives re-renders; only say() restarts the reveal.
  private dlgLine = "";
  private dlgChars = 0;
  private dlgDone = true;
  private dlgTimer: ReturnType<typeof setInterval> | null = null;
  private greetCycles: Partial<Record<DialoguePane, number>> = {};
  private reactCycle = 0;

  // Keyboard focus: index into the hub's menus (0 = nav window).
  private kbdMenu = 0;

  constructor(
    private root: HTMLElement,
    private game: Game,
  ) {
    document.addEventListener("keydown", this.onKey);
  }

  // ---- Dialogue ------------------------------------------------------------

  private say(line: string): void {
    this.dlgLine = line;
    this.dlgChars = 0;
    this.dlgDone = false;
  }

  private sayGreeting(pane: Pane): void {
    const n = this.greetCycles[pane] ?? 0;
    this.greetCycles[pane] = n + 1;
    this.say(greeting(pane, n));
  }

  private react(id: ReactionId): void {
    this.say(reaction(id, this.reactCycle++));
  }

  private completeDialogue(): void {
    if (this.dlgTimer) clearInterval(this.dlgTimer);
    this.dlgTimer = null;
    this.dlgDone = true;
    this.dlgChars = this.dlgLine.length;
    const el = this.root.querySelector<HTMLElement>(".dlg-text");
    if (el) el.textContent = this.dlgLine;
  }

  /** (Re)attach the typewriter to the freshly rendered dialogue window. */
  private paintDialogue(): void {
    if (this.dlgTimer) clearInterval(this.dlgTimer);
    this.dlgTimer = null;
    const el = this.root.querySelector<HTMLElement>(".dlg-text");
    if (!el) return;
    if (this.dlgDone) {
      el.textContent = this.dlgLine;
      return;
    }
    el.textContent = this.dlgLine.slice(0, this.dlgChars);
    this.dlgTimer = setInterval(() => {
      this.dlgChars += 2;
      const cur = this.root.querySelector<HTMLElement>(".dlg-text");
      if (!cur) {
        if (this.dlgTimer) clearInterval(this.dlgTimer);
        this.dlgTimer = null;
        return;
      }
      cur.textContent = this.dlgLine.slice(0, this.dlgChars);
      if (this.dlgChars >= this.dlgLine.length) {
        this.dlgDone = true;
        if (this.dlgTimer) clearInterval(this.dlgTimer);
        this.dlgTimer = null;
      }
    }, 24);
  }

  /** Failure feedback: shopkeeper voice on the hub, plain notice elsewhere. */
  private flash(msg: string) {
    if (this.screen === "hub") this.say(failureLine(msg));
    else this.notice = msg;
    this.render();
  }

  private goto(screen: Screen) {
    this.screen = screen;
    if (screen === "hub") {
      this.pane = "guild";
      this.sayGreeting("guild");
    }
    this.detailId = null;
    this.equipCand = null;
    this.equipSlot = "weapon";
    this.notice = "";
    this.kbdMenu = 0;
    this.render();
  }

  private setPane(pane: Pane) {
    this.pane = pane;
    this.detailId = null;
    this.equipCand = null;
    this.notice = "";
    this.kbdMenu = 0;
    this.sayGreeting(pane);
    this.render();
  }

  // ---- Root layers -----------------------------------------------------------

  /**
   * Root DOM = persistent `.scene-layer` (backdrop canvas, never re-rendered)
   * + `.ui-layer` (wholesale innerHTML re-renders). The run screen wipes both
   * (the stage owns the root); this rebuilds them on the way back.
   */
  private ensureLayers(): void {
    let scene = this.root.querySelector<HTMLElement>(":scope > .scene-layer");
    if (!scene) {
      this.backdrop?.destroy();
      this.root.innerHTML = `<div class="scene-layer"></div><div class="ui-layer"></div>`;
      scene = this.root.querySelector<HTMLElement>(":scope > .scene-layer")!;
      this.backdrop = new Backdrop(scene);
    }
    this.sceneEl = scene;
    this.uiEl = this.root.querySelector<HTMLElement>(":scope > .ui-layer")!;
  }

  render(): void {
    if (this.game.state.activeRun) {
      // Mount the battle stage once; it owns all run-screen updates from here
      // (rAF playback), so wholesale re-renders would only destroy animations.
      if (!this.stage) {
        this.backdrop?.destroy();
        this.backdrop = null;
        this.sceneEl = null;
        this.uiEl = null;
        this.root.innerHTML = this.runShell();
        this.stage = new BattleStage(this.root, this.game);
        this.stage.start();
      }
      return;
    }
    if (this.stage) {
      // Run just settled: return to the Guild pane with the quest report (D2).
      this.stage.stop();
      this.stage = null;
      this.screen = "hub";
      this.pane = "guild";
      this.reportDismissed = false;
      this.sayGreeting("guild");
    }
    this.ensureLayers();
    this.sceneEl!.classList.toggle("scene-hidden", this.screen !== "hub");
    this.uiEl!.className = `ui-layer screen-${this.screen}`;
    this.uiEl!.innerHTML = this.renderScreen();
    if (this.screen === "hub") this.backdrop?.setTheme(this.pane);
    this.bind();
    this.paintDialogue();
    this.paintKbd();
  }

  private renderScreen(): string {
    switch (this.screen) {
      case "select":
        return this.selectScreen();
      case "create":
        return this.createScreen();
      case "hub":
        return this.hubScreen();
    }
  }

  private topbar(title: string, back?: { label: string; screen: Screen }): string {
    const g = this.game.state;
    return `<div class="topbar">
      <h1>${back ? `<button class="small" data-action="goto" data-screen="${back.screen}">◀ ${back.label}</button> ` : ""}✦ ${title}</h1>
      <div class="resources"><span class="meseta">${g.economy.meseta} meseta</span><span>${g.economy.grinders} grinders</span></div>
    </div>`;
  }

  // ---- Character select ------------------------------------------------------

  private selectScreen(): string {
    const g = this.game.state;
    const cards = g.roster
      .map((e) => {
        const c = e.character;
        return `<div class="panel slot-card" data-action="select-char" data-id="${c.id}">
          <div class="slot-name">${c.name}</div>
          <div class="slot-meta">Lv ${c.level} ${CLASS_BY_ID[c.classId].name}</div>
          <div class="slot-meta">${c.sectionId} · ${xpLine(c.classId, c.level, c.xp)}</div>
          <div class="slot-actions">${
            g.roster.length > 1
              ? `<button class="small" data-action="delete-char" data-id="${c.id}">Delete</button>`
              : ""
          }</div>
        </div>`;
      })
      .join("");

    return `${spriteDefs()}${this.topbar("Phantasy Star Idle — Select Character")}
    <div class="notice">${this.notice}</div>
    <div class="slot-grid">
      ${cards}
      <div class="panel slot-card empty" data-action="goto" data-screen="create">— Empty Slot —</div>
    </div>`;
  }

  // ---- Character create (BB order: class → name → derived section ID) --------

  private createScreen(): string {
    const classRows = CLASSES_CANONICAL.map(
      (c) => `<button class="pso-menu-row${c.id === this.createClassId ? " selected" : ""}"
        data-action="pick-class" data-id="${c.id}">
        <span style="flex:1">${c.name}</span><span class="meta">${c.role}</span>
      </button>`,
    ).join("");

    const def = CLASS_BY_ID[this.createClassId];
    const b = def.base;
    const derived = sectionIdFromName(this.createName);
    const sidOptions = SECTION_IDS.map(
      (sid) => `<option value="${sid}"${sid === this.createSid ? " selected" : ""}>${sid}</option>`,
    ).join("");

    return `${spriteDefs()}${this.topbar("Create Character", { label: "Back", screen: "select" })}
    <div class="notice">${this.notice}</div>
    <div class="create-grid">
      <div class="panel">
        <h2>Class</h2>
        <div class="pso-menu">${classRows}</div>
      </div>
      <div class="panel">
        <h2>${def.name} <span class="muted">${def.role}</span></h2>
        <div class="stat-row" style="margin-bottom:12px">
          <span>ATP <b>${b.atp}</b></span><span>DFP <b>${b.dfp}</b></span><span>ATA <b>${b.ata}</b></span>
          <span>EVP <b>${b.evp}</b></span><span>HP <b>${b.hp}</b></span>
        </div>
        <h3>Name</h3>
        <div class="row"><input id="new-name" placeholder="Name" value="${this.createName}" style="flex:1"></div>
        <div class="muted" style="margin:6px 0">Section ID: <b id="create-sid">${this.createSid || derived}</b>${
          this.createSid ? "" : ` <span class="muted">(derived from name)</span>`
        }</div>
        <details class="advanced">
          <summary>Change section ID</summary>
          <div class="row"><label style="flex:1">Section ID
            <select id="new-sid">
              <option value=""${this.createSid === "" ? " selected" : ""}>auto (from name)</option>
              ${sidOptions}
            </select>
          </label></div>
        </details>
        <div class="row" style="margin-top:14px">
          <button class="primary" data-action="create-char">Create</button>
        </div>
      </div>
    </div>`;
  }

  // ---- Pioneer 2 hub: HUD over the scene (pso-hud-menus) ---------------------

  /**
   * PSO status cluster, anchored top-left: hex level chip + name plate + thin
   * XP-to-next bar. The shared economy lives in the money pod (top-right).
   */
  private statusCluster(): string {
    const c = this.game.selectedCharacter();
    const atCap = c.level >= LEVEL_CAP;
    const cur = xpForLevel(c.classId, c.level);
    const next = atCap ? cur : xpForLevel(c.classId, c.level + 1);
    const pct = atCap || next <= cur ? 100 : Math.min(100, Math.max(0, ((c.xp - cur) / (next - cur)) * 100));
    return `<div class="pso-window status-cluster">
      <div class="level-chip"><span>Lv</span><b>${c.level}</b></div>
      <div class="status-main">
        <div class="status-name">${c.name}</div>
        <div class="muted small">${CLASS_BY_ID[c.classId].name} · ${c.sectionId}</div>
        <div class="xp-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
        <div class="muted small">Total Exp <b>${c.xp}pt</b> · To Next Lv <b>${
          atCap ? "— max —" : `${next - c.xp}pt`
        }</b></div>
      </div>
    </div>`;
  }

  private moneyPod(): string {
    const g = this.game.state;
    return `<div class="pso-window money-pod">
      <span class="meseta">${icon("meseta")} ${g.economy.meseta} Meseta</span>
      <span class="muted">${icon("grinder")} ${g.economy.grinders} grinders</span>
    </div>`;
  }

  private hubScreen(): string {
    const g = this.game.state;
    const navRows =
      (Object.keys(PANE_LABELS) as Pane[])
        .map(
          (p, i) => `<button class="pso-menu-row${p === this.pane ? " selected" : ""}"
            data-action="pane" data-pane="${p}">
            <span class="nav-num">${i + 1}</span><span style="flex:1">${PANE_LABELS[p]}</span></button>`,
        )
        .join("") +
      `<button class="pso-menu-row" data-action="goto" data-screen="select">
        <span class="nav-num">7</span><span style="flex:1">Change Character</span>
      </button>`;

    // The report dialog anchors to the Guild pane (a settling run lands there).
    const reportDialog =
      this.pane === "guild" && g.lastReport && !this.reportDismissed
        ? `<div class="dialog-scrim">${this.reportBanner()}</div>`
        : "";

    const pc = this.paneContent();

    return `${spriteDefs()}${reportDialog}
    <div class="hud">
      <div class="hud-status">${this.statusCluster()}</div>
      <div class="hud-money">${this.moneyPod()}</div>
      <nav class="hud-nav">${windowBox("Pioneer 2", `<div class="pso-menu">${navRows}</div>`)}</nav>
      <section class="hud-pane">${pc.main}</section>
      <aside class="hud-detail">${pc.detail}</aside>
      <div class="hud-dialogue">
        <div class="pso-window dialogue-window" data-action="dlg-skip">
          <div class="dlg-text"></div>
        </div>
      </div>
    </div>`;
  }

  private paneContent(): { main: string; detail: string } {
    switch (this.pane) {
      case "guild":
        return this.guildPane();
      case "weapon-shop":
        return this.gearShopPane("weapon");
      case "armour-shop":
        return this.gearShopPane("armour");
      case "tool-shop":
        return this.toolShopPane();
      case "equipment":
        return this.equipmentPane();
      case "bank":
        return this.bankPane();
    }
  }

  // ---- Hunter's Guild pane (quest counter, menu idioms — no form controls) ----

  private guildPane(): { main: string; detail: string } {
    const g = this.game.state;
    const entry = this.game.selectedEntry();

    const areaRows = AREA_LIST.map(
      (a) => `<button class="pso-menu-row${a.id === this.areaSel ? " selected" : ""}"
        data-action="area" data-id="${a.id}">
        <span style="flex:1">${a.name}</span><span class="meta">rec. ATP ${a.recommendedAtp}</span>
      </button>`,
    ).join("");

    const diffChips = (Object.keys(DIFFICULTIES) as DifficultyId[])
      .map(
        (d) => `<button class="chip hex${d === this.diffSel ? " selected" : ""}"
          data-action="diff" data-id="${d}">${DIFFICULTIES[d].label}</button>`,
      )
      .join("");

    const curPattern = patternName(entry.pattern);
    const patternChips = Object.keys(PATTERN_PRESETS)
      .map(
        (name) => `<button class="chip${name === curPattern ? " selected" : ""}"
          data-action="pattern" data-id="${name}">${name} <span class="chip-meta">${patternMeta(PATTERN_PRESETS[name])}</span></button>`,
      )
      .join("");

    const main = windowBox(
      "Hunter's Guild",
      `<h3>Area</h3>
      <div class="pso-menu">${areaRows}</div>
      <h3 style="margin-top:10px">Difficulty</h3>
      <div class="chip-row">${diffChips}</div>
      <h3 style="margin-top:10px">Attack pattern</h3>
      <div class="chip-row">${patternChips}</div>
      <button class="primary" data-action="send" style="width:100%;margin-top:14px">▶ Accept Quest</button>`,
      "Quest Counter",
    );

    const detail = windowBox(
      "Counter Settings",
      `<h3>Loot filter</h3>
      <div class="row">
        <label>Auto-sell below <input id="filter-below" type="number" min="0" value="${entry.filter.autoSellBelow}" style="width:90px"> m</label>
      </div>
      <div class="row">
        <label><input id="filter-keep-rare" type="checkbox" ${entry.filter.alwaysKeep.includes("rare") ? "checked" : ""}> keep rares</label>
        <button class="small" data-action="apply-filter">Apply</button>
      </div>
      <h3 style="margin-top:12px">Supply</h3>
      <div class="muted">${supplyLine(g.supply)}</div>`,
    );

    return { main, detail };
  }

  // ---- Shop & bank panes (list window + detail window) ------------------------

  private itemRowButton(item: Item, trailing: string): string {
    return `<button class="pso-menu-row rarity-${item.rarity}${item.id === this.detailId ? " selected" : ""}"
      data-action="detail" data-id="${item.id}">
      ${icon(iconForKind(item.kind))}<span class="name" style="flex:1">${item.name}</span><span class="meta num">${trailing}</span>
    </button>`;
  }

  private itemDetail(item: Item, actions: string, extra = ""): string {
    return `<div class="detail-name">${icon(iconForKind(item.kind))} ${item.name}</div>
      <div class="detail-flavor">${itemFlavor(item)}</div>
      <div class="muted small" style="margin-bottom:8px">${itemMeta(item)}</div>
      ${extra}
      <div class="row" style="margin-top:12px">${actions}</div>`;
  }

  /**
   * PSO-style stat preview: current effective stats vs. as-if the change were
   * made, with ▲/▼ change markers. Displayed ATP folds in the equipment's
   * EQATP contribution (as PSO's status window does) so weapon comparisons are
   * meaningful — effectiveStats alone carries weapon ATP via the damage
   * formula, not the stat block.
   */
  private statPreview(
    slot: "weapon" | "frame" | "barrier" | "unit",
    item: Item | null,
    removeUnitId?: string,
  ): string {
    const character = this.game.selectedCharacter();
    const cur = effectiveStats(character);
    const nextEq = previewEquipment(character, slot, item as never, removeUnitId);
    const next = effectiveStats({ ...character, equipment: nextEq } as Character);
    const rows: Array<[string, number, number]> = [
      ["ATP", cur.atp + Math.floor(equipmentAtp(character.equipment)), next.atp + Math.floor(equipmentAtp(nextEq))],
      ["DFP", cur.dfp, next.dfp],
      ["ATA", cur.ata, next.ata],
      ["EVP", cur.evp, next.evp],
      ["LCK", cur.lck, next.lck],
      ["HP", cur.hp, next.hp],
    ];
    const body = rows
      .map(([label, a, b]) => {
        const cls = b > a ? "diff-up" : b < a ? "diff-down" : "diff-same";
        const mark = b > a ? "▲" : b < a ? "▼" : "";
        return `<tr><th>${label}</th><td>${a}</td><td class="${cls}">${b} ${mark}</td></tr>`;
      })
      .join("");
    return `<table class="diff-table"><tr><th></th><th class="muted">now</th><th class="muted">after</th></tr>${body}</table>`;
  }

  /** The equipped item currently occupying the slot an item would go into. */
  private equippedInSlot(item: Item): Item | null {
    const eq = this.game.selectedCharacter().equipment;
    return item.kind === "weapon" ? eq.weapon : item.kind === "frame" ? eq.frame : item.kind === "barrier" ? eq.barrier : null;
  }

  private equippedLine(current: Item): string {
    return `<div class="equipped-line"><span class="equipped-mark">E</span> ${current.name} — <span class="muted small">${itemMeta(current)}</span></div>`;
  }

  private gearShopPane(kind: ShopKind): { main: string; detail: string } {
    const stock = this.game.shopStock(kind);
    const character = this.game.selectedCharacter();
    const emptyMsg = `Sold out — stock refreshes as ${character.name} gains levels.`;
    const rows = stock.offers.map((o) => this.itemRowButton(o, `${gearPrice(o)}m`)).join("");
    const sel = stock.offers.find((o) => o.id === this.detailId) ?? stock.offers[0] ?? null;
    let detail = `<div class="muted">${emptyMsg}</div>`;
    if (sel) {
      const current = this.equippedInSlot(sel);
      const atUnitCap =
        isUnit(sel) && character.equipment.units.length >= unitCapacity(character.equipment);
      const preview = atUnitCap
        ? `<div class="muted">No free unit slot — equip a frame with room first.</div>`
        : this.statPreview(sel.kind, sel);
      detail = this.itemDetail(
        sel,
        `<span class="muted">${gearPrice(sel)}m</span>
         <button class="primary" data-action="buy-gear" data-kind="${kind}" data-id="${sel.id}">Buy</button>`,
        (current ? this.equippedLine(current) : "") + `<h3>If equipped</h3>${preview}`,
      );
    }
    const label = PANE_LABELS[kind === "weapon" ? "weapon-shop" : "armour-shop"];
    return {
      main: windowBox(
        label,
        `<div class="pso-menu shop-list">${rows || `<div class="muted">${emptyMsg}</div>`}</div>`,
        `${stock.offers.length} in stock`,
      ),
      detail: windowBox("Item Info", `<div class="shop-detail">${detail}</div>`),
    };
  }

  private toolShopPane(): { main: string; detail: string } {
    const rows =
      CONSUMABLES_LIST.map(
        (c) => `<button class="pso-menu-row${c.id === this.detailId ? " selected" : ""}"
          data-action="detail" data-id="${c.id}">
          ${icon(iconForKind(c.kind))}<span style="flex:1">${c.name}</span><span class="meta num">${c.price}m</span>
        </button>`,
      ).join("") +
      `<button class="pso-menu-row${this.detailId === "grinder" ? " selected" : ""}"
        data-action="detail" data-id="grinder">
        ${icon("grinder")}<span style="flex:1">Grinder</span><span class="meta num">${GRINDER_PRICE}m</span>
      </button>`;

    const selCons = CONSUMABLES_LIST.find((c) => c.id === this.detailId);
    const detail =
      this.detailId === "grinder"
        ? `<div class="detail-name">${icon("grinder")} Grinder</div>
           <div class="detail-flavor">${flavor("Grinder", "grinder")}</div>
           <div class="muted small" style="margin-bottom:8px">Raises an equipped weapon's grind by 1, up to its cap.</div>
           <div class="row" style="margin-top:12px"><span class="muted">${GRINDER_PRICE}m each</span>
             <button data-action="buy-grinder" data-qty="1">Buy 1</button>
             <button data-action="buy-grinder" data-qty="5">Buy 5</button></div>`
        : selCons
          ? `<div class="detail-name">${icon(iconForKind(selCons.kind))} ${selCons.name}</div>
             <div class="detail-flavor">${flavor(selCons.name, selCons.kind)}</div>
             <div class="muted small" style="margin-bottom:8px">${
               selCons.kind === "heal" ? `Restores ${selCons.amount} HP during a run.` : "Revives once when defeated during a run."
             }</div>
             <div class="row" style="margin-top:12px"><span class="muted">${selCons.price}m each</span>
               <button data-action="buy" data-id="${selCons.id}" data-qty="1">Buy 1</button>
               <button data-action="buy" data-id="${selCons.id}" data-qty="10">Buy 10</button></div>`
          : `<div class="muted">Select an item.</div>`;

    return {
      main: windowBox("Tool Shop", `<div class="pso-menu shop-list">${rows}</div>`),
      detail: windowBox("Item Info", `<div class="shop-detail">${detail}</div>`),
    };
  }

  private bankPane(): { main: string; detail: string } {
    const inv = this.game.state.economy.inventory;
    const emptyMsg = "Inventory empty — send a run to find gear.";
    const rows = inv.map((i) => this.itemRowButton(i, `${itemSellValue(i)}m`)).join("");
    const sel = inv.find((i) => i.id === this.detailId) ?? inv[0] ?? null;
    const current = sel ? this.equippedInSlot(sel) : null;
    const detail = sel
      ? this.itemDetail(
          sel,
          `<button class="primary" data-action="equip" data-id="${sel.id}">Equip</button>
           <button data-action="sell" data-id="${sel.id}">Sell (${itemSellValue(sel)}m)</button>`,
          current ? this.equippedLine(current) : "",
        )
      : `<div class="muted">${emptyMsg}</div>`;
    return {
      main: windowBox(
        "Inventory/Bank",
        `<div class="pso-menu shop-list">${rows || `<div class="muted">${emptyMsg}</div>`}</div>`,
        `${inv.length} items`,
      ),
      detail: windowBox("Item Info", `<div class="shop-detail">${detail}</div>`),
    };
  }

  // ---- Equipment pane: PSO-style slot → candidates → preview → equip ----------

  private equipmentPane(): { main: string; detail: string } {
    const character = this.game.selectedCharacter();
    const eq = character.equipment;
    const inv = this.game.state.economy.inventory;
    const cap = unitCapacity(eq);

    const slotRows = (
      [
        ["weapon", "Weapon", eq.weapon ? `${eq.weapon.name} +${eq.weapon.grind}` : "— none —"],
        ["frame", "Frame", eq.frame ? eq.frame.name : "— none —"],
        ["barrier", "Barrier", eq.barrier ? eq.barrier.name : "— none —"],
        ["units", `Units ${eq.units.length}/${cap}`, eq.units.map((u) => u.name).join(", ") || "— none —"],
      ] as Array<[EquipSlot, string, string]>
    )
      .map(
        ([id, label, meta]) => `<button class="pso-menu-row${id === this.equipSlot ? " selected" : ""}"
          data-action="equip-slot" data-id="${id}">
          ${icon(SLOT_ICONS[id])}<span style="flex:1">${label}</span><span class="meta">${meta}</span>
        </button>`,
      )
      .join("");

    const candRow = (id: string, name: string, meta: string, rarity = "", kind = "") =>
      `<button class="pso-menu-row${rarity ? ` rarity-${rarity}` : ""}${id === this.equipCand ? " selected" : ""}"
        data-action="equip-cand" data-id="${id}">
        ${kind ? icon(iconForKind(kind)) : ""}<span class="name" style="flex:1">${name}</span><span class="meta">${meta}</span>
      </button>`;

    let candidates: string;
    if (this.equipSlot === "units") {
      candidates =
        eq.units
          .map((u) =>
            candRow(`remove:${u.id}`, `Remove ${u.name}`, `<span class="equipped-mark">E</span>`, u.rarity, u.kind),
          )
          .join("") +
        inv
          .filter(isUnit)
          .map((u) => candRow(u.id, u.name, itemMeta(u), u.rarity, u.kind))
          .join("");
    } else {
      const equipped = eq[this.equipSlot];
      candidates =
        (equipped
          ? candRow("remove", `Remove ${equipped.name}`, `<span class="equipped-mark">E</span>`, equipped.rarity, equipped.kind)
          : "") +
        inv
          .filter((i) => i.kind === this.equipSlot)
          .map((i) => candRow(i.id, i.name, itemMeta(i), i.rarity, i.kind))
          .join("");
    }

    const main = `${windowBox("Slots", `<div class="pso-menu">${slotRows}</div>`)}
      ${windowBox(
        `Candidates — ${this.equipSlot}`,
        `<div class="pso-menu shop-list">${candidates || `<div class="muted">Nothing equippable — visit the shops or send a run.</div>`}</div>`,
      )}`;
    return { main, detail: windowBox("Preview", `<div class="shop-detail">${this.equipDetail()}</div>`) };
  }

  /** Right column of the Equipment pane: preview + confirm for the highlighted candidate. */
  private equipDetail(): string {
    const character = this.game.selectedCharacter();
    const eq = character.equipment;
    const g = this.game.state;
    const cand = this.equipCand;

    // No candidate highlighted: show the slot's current state (+ grind on weapon).
    if (!cand) {
      const grind =
        this.equipSlot === "weapon" && eq.weapon
          ? `<div class="muted" style="margin:8px 0 4px">${eq.weapon.name} +${eq.weapon.grind}/${eq.weapon.maxGrind}</div>
             <div class="row"><button class="small" data-action="grind">Grind (${g.economy.grinders} grinders)</button></div>`
          : "";
      return `<div class="muted">Select an item to preview the stat change.</div>${grind}`;
    }

    if (cand === "remove") {
      const slot = this.equipSlot as "weapon" | "frame" | "barrier";
      const equipped = eq[slot];
      if (!equipped) return `<div class="muted">Nothing equipped.</div>`;
      const note =
        slot === "frame" && eq.units.length > 0
          ? `<div class="muted">Mounted units return to the inventory too.</div>`
          : "";
      return `<div class="detail-name">Remove ${equipped.name}</div>
        ${this.statPreview(slot, null)}${note}
        <div class="row" style="margin-top:12px">
          <button class="primary" data-action="unequip" data-slot="${slot}">Remove</button>
        </div>`;
    }

    if (cand.startsWith("remove:")) {
      const unitId = cand.slice("remove:".length);
      const u = eq.units.find((x) => x.id === unitId);
      if (!u) return `<div class="muted">Nothing equipped.</div>`;
      return `<div class="detail-name">Remove ${u.name}</div>
        ${this.statPreview("unit", null, unitId)}
        <div class="row" style="margin-top:12px">
          <button class="primary" data-action="unequip-unit" data-id="${unitId}">Remove</button>
        </div>`;
    }

    const item = this.game.state.economy.inventory.find((i) => i.id === cand);
    if (!item) return `<div class="muted">Select an item to preview the stat change.</div>`;
    const atUnitCap = isUnit(item) && eq.units.length >= unitCapacity(eq);
    const preview = atUnitCap
      ? `<div class="muted">${unitCapacity(eq) === 0 ? "No frame equipped — units mount on a frame." : "No free unit slot — remove a unit first."}</div>`
      : this.statPreview(item.kind, item);
    return `<div class="detail-name">${icon(iconForKind(item.kind))} ${item.name}</div>
      <div class="detail-flavor">${itemFlavor(item)}</div>
      <div class="muted small" style="margin-bottom:8px">${itemMeta(item)}</div>
      ${preview}
      <div class="row" style="margin-top:12px">
        <button class="primary" data-action="equip" data-id="${item.id}"${atUnitCap ? " disabled" : ""}>Equip</button>
      </div>`;
  }

  private reportBanner(): string {
    const r = this.game.state.lastReport!;
    const items = r.items.length ? r.items.map((i) => i.name).join(", ") : "no gear kept";
    const used = supplyLine(r.consumablesUsed);
    const gained = supplyLine(r.consumablesGained);
    const levelNote = r.levelsGained > 0 ? ` (LEVEL UP → ${r.level}!)` : "";
    return `<div class="report ${r.outcome}">
      <h2 class="outcome-${r.outcome}">${r.outcome === "complete" ? "Run complete!" : "Ejected!"} — ${r.characterName}, ${r.areaName} (${r.difficultyLabel})</h2>
      <div class="stat-row">
        <span>Rooms <b>${r.roomsCleared}/${r.totalRooms}</b></span>
        <span>Meseta <b>${r.meseta}</b></span>
        <span>XP <b>${r.xpGained}${levelNote}</b></span>
        <span>Grinders <b>${r.grinders}</b></span>
      </div>
      <div style="margin-top:6px">Kept: <b>${items}</b></div>
      <div class="muted">Consumables gained: ${gained} · used: ${used}</div>
      <div class="row" style="margin-top:10px"><button data-action="dismiss-report">Close</button></div>
    </div>`;
  }

  // ---- Run screen shell (8.2, 8.4 + battle-scene-view D4) -------------------
  // Static markup only: every element the BattleStage updates carries an id.

  private runShell(): string {
    const g = this.game.state;
    const prog = this.game.runProgress()!;
    const character = g.activeRun!.input.character;

    return `
    <div class="topbar">
      <h1>✦ Run in progress</h1>
      <div class="resources"><span class="meseta">${g.economy.meseta} meseta</span></div>
    </div>
    <div class="panel">
      <h2>${prog.areaName} — ${prog.difficultyLabel}</h2>
      <div class="rooms stage-rooms"></div>
      <div class="progress"><span class="stage-progress"></span></div>
      <div class="stat-row" style="margin-top:8px">
        <span>Progress <b class="stage-pct">0%</b></span>
        <span>Enemies defeated <b class="stage-kills">0</b></span>
        <span class="stage-status muted">Running…</span>
      </div>
    </div>
    <div class="panel stage" style="margin-top:14px">
      <div class="stage-ticker">…</div>
      <div class="stage-field"></div>
      <div class="stage-bottom">
        <div class="stage-player-box">
          <div class="stage-player-head"><b>${character.name}</b><span class="stage-room-label muted">—</span></div>
          <div class="hpbar hp-char"><span class="stage-char-hp"></span></div>
          <div class="stage-char-hp-text muted"></div>
        </div>
        <div class="stage-side stage-supply muted"></div>
      </div>
    </div>
    <div class="panel" style="margin-top:14px">
      <h3>Battle log</h3>
      <div class="log log-compact stage-log"></div>
    </div>`;
  }

  // ---- Keyboard navigation (ui-navigation "Keyboard menu navigation") --------

  private hubMenus(): HTMLElement[] {
    if (!this.uiEl) return [];
    return Array.from(this.uiEl.querySelectorAll<HTMLElement>(".hud .pso-menu"));
  }

  /** Mark the keyboard-focused menu; the orange bar inside it is the indicator. */
  private paintKbd(): void {
    const menus = this.hubMenus();
    if (!menus.length) return;
    this.kbdMenu = Math.min(this.kbdMenu, menus.length - 1);
    menus.forEach((m, i) => m.classList.toggle("kbd-active", i === this.kbdMenu));
  }

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    if (this.screen !== "hub" || this.game.state.activeRun) return;

    // Any key first completes an in-progress dialogue reveal.
    if (!this.dlgDone) {
      this.completeDialogue();
      if (e.key === "Enter") return;
    }

    // Digit shortcuts jump straight to a nav entry (7 = Change Character).
    if (/^[1-7]$/.test(e.key)) {
      const panes = Object.keys(PANE_LABELS) as Pane[];
      const idx = Number(e.key) - 1;
      if (idx < panes.length) this.setPane(panes[idx]);
      else this.goto("select");
      e.preventDefault();
      return;
    }

    const menus = this.hubMenus();
    if (!menus.length) return;
    this.kbdMenu = Math.min(this.kbdMenu, menus.length - 1);

    switch (e.key) {
      case "ArrowRight":
        this.kbdMenu = Math.min(menus.length - 1, this.kbdMenu + 1);
        this.paintKbd();
        e.preventDefault();
        break;
      case "ArrowLeft":
      case "Escape":
        // Step back one level: candidates → slots → nav.
        this.kbdMenu = Math.max(0, this.kbdMenu - 1);
        this.paintKbd();
        e.preventDefault();
        break;
      case "ArrowUp":
      case "ArrowDown": {
        const rows = Array.from(menus[this.kbdMenu].querySelectorAll<HTMLElement>(".pso-menu-row"));
        if (!rows.length) break;
        const cur = rows.findIndex((r) => r.classList.contains("selected"));
        const next =
          cur < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, cur + (e.key === "ArrowDown" ? 1 : -1)));
        if (next !== cur) rows[next].click();
        e.preventDefault();
        break;
      }
      case "Enter": {
        // Confirm: the pane's primary action (Buy / Equip / Accept Quest / Remove).
        const primary = this.uiEl?.querySelector<HTMLElement>(
          ".hud-detail .primary:not([disabled]), .hud-pane .primary:not([disabled])",
        );
        primary?.click();
        e.preventDefault();
        break;
      }
    }
  };

  // ---- Event binding -------------------------------------------------------

  private bind(): void {
    const q = <T extends HTMLElement>(sel: string) => this.root.querySelector<T>(sel);
    this.root.querySelectorAll<HTMLElement>("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // Cards nest action buttons (e.g. Delete inside a slot card).
        e.stopPropagation();
        this.onAction(btn);
      });
    });

    // Create screen: track the draft and update the derived section ID live,
    // without re-rendering (a wholesale re-render would steal input focus).
    const nameInput = q<HTMLInputElement>("#new-name");
    const sidSel = q<HTMLSelectElement>("#new-sid");
    const sidOut = q<HTMLElement>("#create-sid");
    const updateSid = () => {
      if (sidOut) {
        sidOut.textContent = this.createSid || sectionIdFromName(this.createName);
      }
    };
    nameInput?.addEventListener("input", () => {
      this.createName = nameInput.value;
      updateSid();
    });
    sidSel?.addEventListener("change", () => {
      this.createSid = sidSel.value as SectionId | "";
      updateSid();
    });
  }

  private onAction(btn: HTMLElement): void {
    const a = btn.dataset.action!;
    const id = btn.dataset.id;
    this.notice = "";
    let res: { ok: boolean; reason?: string } = { ok: true };

    switch (a) {
      case "goto":
        this.goto(btn.dataset.screen as Screen);
        return;
      case "pane":
        this.setPane(btn.dataset.pane as Pane);
        return;
      case "dlg-skip":
        this.completeDialogue();
        return;
      case "detail":
        this.detailId = id!;
        break;
      case "area":
        this.areaSel = id!;
        break;
      case "diff":
        this.diffSel = id as DifficultyId;
        break;
      case "pattern":
        this.game.setPattern(PATTERN_PRESETS[id!] ?? this.game.selectedEntry().pattern);
        break;
      case "equip-slot":
        this.equipSlot = id as EquipSlot;
        this.equipCand = null;
        break;
      case "equip-cand":
        this.equipCand = id!;
        break;
      case "dismiss-report":
        this.reportDismissed = true;
        break;
      case "pick-class":
        this.createClassId = id!;
        break;
      case "send":
        res = this.game.sendRun(this.areaSel, this.diffSel);
        break;
      case "equip":
        res = this.game.equipFromInventory(id!);
        if (res.ok) {
          this.equipCand = null;
          this.react("equipped");
        }
        break;
      case "sell":
        res = this.game.sellInventoryItem(id!);
        if (res.ok) {
          if (this.detailId === id) this.detailId = null;
          this.react("sold");
        }
        break;
      case "unequip":
        res = this.game.unequipToInventory(btn.dataset.slot as "weapon" | "frame" | "barrier");
        if (res.ok) {
          this.equipCand = null;
          this.react("removed");
        }
        break;
      case "unequip-unit":
        res = this.game.unequipToInventory("unit", id);
        if (res.ok) {
          this.equipCand = null;
          this.react("removed");
        }
        break;
      case "grind":
        res = this.game.grindEquippedWeapon();
        if (res.ok) this.react("grind");
        break;
      case "buy":
        res = this.game.buyConsumable(id as never, Number(btn.dataset.qty));
        if (res.ok) this.react("bought");
        break;
      case "buy-grinder":
        res = this.game.buyGrinders(Number(btn.dataset.qty));
        if (res.ok) this.react("bought");
        break;
      case "select-char":
        res = this.game.selectCharacter(id!);
        if (res.ok) {
          this.goto("hub");
          return;
        }
        break;
      case "delete-char": {
        const name = this.game.state.roster.find((e) => e.character.id === id)?.character.name;
        if (window.confirm(`Delete ${name}? Equipped gear returns to the shared inventory.`)) {
          res = this.game.deleteCharacter(id!);
        }
        break;
      }
      case "create-char": {
        res = this.game.createCharacter(
          this.createName,
          this.createClassId,
          this.createSid === "" ? undefined : this.createSid,
        );
        if (res.ok) {
          const created = this.game.state.roster[this.game.state.roster.length - 1].character;
          this.game.selectCharacter(created.id);
          this.createName = "";
          this.createSid = "";
          this.goto("hub");
          return;
        }
        break;
      }
      case "buy-gear":
        res = this.game.buyGearFromShop(btn.dataset.kind as ShopKind, id!);
        if (res.ok) {
          if (this.detailId === id) this.detailId = null;
          this.react("bought");
        }
        break;
      case "apply-filter": {
        const below = Number(this.root.querySelector<HTMLInputElement>("#filter-below")!.value);
        const keepRare = this.root.querySelector<HTMLInputElement>("#filter-keep-rare")!.checked;
        this.game.setFilter({ autoSellBelow: below, alwaysKeep: keepRare ? ["rare"] : [] });
        this.react("filter");
        break;
      }
    }

    if (!res.ok) this.flash(res.reason ?? "Action failed.");
    else this.render();
  }
}
