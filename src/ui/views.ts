/**
 * Meta-layer UI — vanilla DOM over the Game engine (design D10), restructured
 * around a PSO BB-style screen flow (pso-ui-overhaul):
 *
 *   character select → (create) → Pioneer 2 hub (master-detail shell)
 *
 * The hub (pioneer2-hub-redesign) is a persistent shell — PSO BB status bar +
 * sidebar — whose detail region renders one pane: Hunters Guild, the shops,
 * Equipment (PSO-style slot → candidates → stat preview flow), or the
 * Inventory/Bank. The router is UI-local state (D1): never persisted, boots to
 * character select, and an active run overrides everything; entering the hub
 * always lands on the Guild pane. The run screen is a persistent shell whose
 * dynamic parts are owned by the BattleStage (battle-scene-view D3): render()
 * mounts the shell once and skips rebuilds while the stage is live, so its
 * animations survive. When a run settles the router is forced back to the hub
 * and the report shows as a dialog over the Guild pane (D2).
 */

import type { Game } from "../engine/game";
import { AREA_LIST } from "../engine/content";
import { BattleStage } from "./stage";
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

type Screen = "select" | "create" | "hub";

/** Hub detail panes, one per sidebar entry (Change Character is navigation). */
type Pane = "guild" | "weapon-shop" | "armour-shop" | "tool-shop" | "equipment" | "bank";

const PANE_LABELS: Record<Pane, string> = {
  guild: "Hunters Guild",
  "weapon-shop": "Weapon Shop",
  "armour-shop": "Armour Shop",
  "tool-shop": "Tool Shop",
  equipment: "Equipment",
  bank: "Inventory/Bank",
};

/** Equipment-pane slot selector; "units" covers the frame's unit mounts. */
type EquipSlot = "weapon" | "frame" | "barrier" | "units";

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
  "Balanced (N-N-H)": ["normal", "normal", "heavy"],
  "Aggressive (H-H-H)": ["heavy", "heavy", "heavy"],
  "Steady (N-N-N)": ["normal", "normal", "normal"],
  "Quick (N-H)": ["normal", "heavy"],
};

function patternName(pattern: AttackType[]): string {
  for (const [name, p] of Object.entries(PATTERN_PRESETS)) {
    if (p.length === pattern.length && p.every((x, i) => x === pattern[i])) return name;
  }
  return pattern.map((t) => t[0].toUpperCase()).join("-");
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

export class UI {
  private notice = "";
  private stage: BattleStage | null = null;

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

  constructor(
    private root: HTMLElement,
    private game: Game,
  ) {}

  private flash(msg: string) {
    this.notice = msg;
    this.render();
  }

  private goto(screen: Screen) {
    this.screen = screen;
    if (screen === "hub") this.pane = "guild";
    this.detailId = null;
    this.equipCand = null;
    this.equipSlot = "weapon";
    this.notice = "";
    this.render();
  }

  private setPane(pane: Pane) {
    this.pane = pane;
    this.detailId = null;
    this.equipCand = null;
    this.notice = "";
    this.render();
  }

  render(): void {
    if (this.game.state.activeRun) {
      // Mount the battle stage once; it owns all run-screen updates from here
      // (rAF playback), so wholesale re-renders would only destroy animations.
      if (!this.stage) {
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
    }
    this.root.innerHTML = this.renderScreen();
    this.bind();
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

    return `${this.topbar("Phantasy Star Idle — Select Character")}
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

    return `${this.topbar("Create Character", { label: "Back", screen: "select" })}
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

  // ---- Pioneer 2 hub: master-detail shell (pioneer2-hub-redesign) ------------

  /**
   * PSO BB-style status window shown at the top of every hub pane: identity,
   * level, XP progression, and the shared economy. Select/create/run screens
   * keep their own headers.
   */
  private statusBar(): string {
    const g = this.game.state;
    const c = this.game.selectedCharacter();
    const atCap = c.level >= LEVEL_CAP;
    const toNext = atCap ? null : xpForLevel(c.classId, c.level + 1) - c.xp;
    return `<div class="panel status-bar">
      <div class="status-id">
        <div class="status-name">${c.name}</div>
        <div class="muted">${CLASS_BY_ID[c.classId].name} · ${c.sectionId}</div>
      </div>
      <div class="status-level">Lv <b>${c.level}</b></div>
      <div class="status-fields">
        <div><span class="muted">Total Exp</span><b>${c.xp}pt</b></div>
        <div><span class="muted">To Next Lv</span><b>${atCap ? "— max —" : `${toNext}pt`}</b></div>
        <div><span class="muted">Money</span><b class="meseta">${g.economy.meseta} Meseta</b></div>
        <div><span class="muted">Grinders</span><b>${g.economy.grinders}</b></div>
      </div>
    </div>`;
  }

  private hubScreen(): string {
    const g = this.game.state;
    const sidebar = (Object.keys(PANE_LABELS) as Pane[])
      .map(
        (p) => `<button class="pso-menu-row${p === this.pane ? " selected" : ""}"
          data-action="pane" data-pane="${p}"><span style="flex:1">${PANE_LABELS[p]}</span></button>`,
      )
      .join("");

    // The report dialog anchors to the Guild pane (a settling run lands there).
    const reportDialog =
      this.pane === "guild" && g.lastReport && !this.reportDismissed
        ? `<div class="dialog-scrim">${this.reportBanner()}</div>`
        : "";

    return `${this.statusBar()}
    <div class="notice">${this.notice}</div>
    ${reportDialog}
    <div class="hub-shell">
      <nav class="panel sidebar">
        <h2>Pioneer 2</h2>
        <div class="pso-menu">
          ${sidebar}
          <button class="pso-menu-row" data-action="goto" data-screen="select">
            <span style="flex:1">Change Character</span>
          </button>
        </div>
      </nav>
      <div class="hub-detail">${this.paneContent()}</div>
    </div>`;
  }

  private paneContent(): string {
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

  // ---- Hunters Guild pane (quest counter) -------------------------------------

  private guildPane(): string {
    const g = this.game.state;
    const entry = this.game.selectedEntry();

    const areaOptions = AREA_LIST.map(
      (a) =>
        `<option value="${a.id}"${a.id === this.areaSel ? " selected" : ""}>${a.name} (rec. ATP ${a.recommendedAtp})</option>`,
    ).join("");
    const diffOptions = (Object.keys(DIFFICULTIES) as DifficultyId[])
      .map(
        (d) =>
          `<option value="${d}"${d === this.diffSel ? " selected" : ""}>${DIFFICULTIES[d].label}</option>`,
      )
      .join("");
    const patternOptions = Object.keys(PATTERN_PRESETS)
      .map(
        (name) =>
          `<option value="${name}"${name === patternName(entry.pattern) ? " selected" : ""}>${name}</option>`,
      )
      .join("");

    return `<div class="panel">
      <h2>Hunter's Guild</h2>
      <div class="muted" style="margin-bottom:8px">Take a quest and head down to the surface.</div>
      <div class="row"><label style="flex:1">Area <select id="area">${areaOptions}</select></label></div>
      <div class="row"><label style="flex:1">Difficulty <select id="difficulty">${diffOptions}</select></label></div>
      <div class="row"><label style="flex:1">Attack pattern <select id="pattern">${patternOptions}</select></label></div>
      <h3 style="margin-top:12px">Loot filter</h3>
      <div class="row">
        <label>Auto-sell below <input id="filter-below" type="number" min="0" value="${entry.filter.autoSellBelow}" style="width:90px"> m</label>
        <label><input id="filter-keep-rare" type="checkbox" ${entry.filter.alwaysKeep.includes("rare") ? "checked" : ""}> keep rares</label>
        <button class="small" data-action="apply-filter">Apply</button>
      </div>
      <h3 style="margin-top:12px">Supply</h3>
      <div class="muted" style="margin-bottom:10px">${supplyLine(g.supply)}</div>
      <button class="primary" data-action="send" style="width:100%">▶ Accept Quest</button>
    </div>`;
  }

  // ---- Shop & bank panes (shared list+detail shape, D3) -----------------------

  private paneListDetail(rows: string, detail: string, emptyMsg: string): string {
    return `<div class="shop-grid">
      <div class="panel">
        <div class="pso-menu shop-list">${rows || `<div class="muted">${emptyMsg}</div>`}</div>
      </div>
      <div class="panel shop-detail">${detail}</div>
    </div>`;
  }

  private itemRowButton(item: Item, trailing: string): string {
    return `<button class="pso-menu-row rarity-${item.rarity}${item.id === this.detailId ? " selected" : ""}"
      data-action="detail" data-id="${item.id}">
      <span class="name" style="flex:1">${item.name}</span><span class="meta">${trailing}</span>
    </button>`;
  }

  private itemDetail(item: Item, actions: string, extra = ""): string {
    return `<div class="detail-name">${item.name}</div>
      <div class="muted" style="margin-bottom:8px">${itemMeta(item)}</div>
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

  private gearShopPane(kind: ShopKind): string {
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
        (current ? `<div class="muted" style="margin-bottom:6px">Equipped: ${current.name} — ${itemMeta(current)}</div>` : "") +
          `<h3>If equipped</h3>${preview}`,
      );
    }
    return this.paneListDetail(rows, detail, emptyMsg);
  }

  private toolShopPane(): string {
    const rows =
      CONSUMABLES_LIST.map(
        (c) => `<button class="pso-menu-row${c.id === this.detailId ? " selected" : ""}"
          data-action="detail" data-id="${c.id}">
          <span style="flex:1">${c.name}</span><span class="meta">${c.price}m</span>
        </button>`,
      ).join("") +
      `<button class="pso-menu-row${this.detailId === "grinder" ? " selected" : ""}"
        data-action="detail" data-id="grinder">
        <span style="flex:1">Grinder</span><span class="meta">${GRINDER_PRICE}m</span>
      </button>`;

    const selCons = CONSUMABLES_LIST.find((c) => c.id === this.detailId);
    const detail =
      this.detailId === "grinder"
        ? `<div class="detail-name">Grinder</div>
           <div class="muted" style="margin-bottom:8px">Raises an equipped weapon's grind by 1, up to its cap.</div>
           <div class="row" style="margin-top:12px"><span class="muted">${GRINDER_PRICE}m each</span>
             <button data-action="buy-grinder" data-qty="1">Buy 1</button>
             <button data-action="buy-grinder" data-qty="5">Buy 5</button></div>`
        : selCons
          ? `<div class="detail-name">${selCons.name}</div>
             <div class="muted" style="margin-bottom:8px">${
               selCons.kind === "heal" ? `Restores ${selCons.amount} HP during a run.` : "Revives once when defeated during a run."
             }</div>
             <div class="row" style="margin-top:12px"><span class="muted">${selCons.price}m each</span>
               <button data-action="buy" data-id="${selCons.id}" data-qty="1">Buy 1</button>
               <button data-action="buy" data-id="${selCons.id}" data-qty="10">Buy 10</button></div>`
          : `<div class="muted">Select an item.</div>`;

    return this.paneListDetail(rows, detail, "Nothing in stock.");
  }

  private bankPane(): string {
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
          current ? `<div class="muted">Equipped: ${current.name} — ${itemMeta(current)}</div>` : "",
        )
      : `<div class="muted">${emptyMsg}</div>`;
    return this.paneListDetail(rows, detail, emptyMsg);
  }

  // ---- Equipment pane: PSO-style slot → candidates → preview → equip ----------

  private equipmentPane(): string {
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
          <span style="flex:1">${label}</span><span class="meta">${meta}</span>
        </button>`,
      )
      .join("");

    const candRow = (id: string, name: string, meta: string, rarity = "") =>
      `<button class="pso-menu-row${rarity ? ` rarity-${rarity}` : ""}${id === this.equipCand ? " selected" : ""}"
        data-action="equip-cand" data-id="${id}">
        <span class="name" style="flex:1">${name}</span><span class="meta">${meta}</span>
      </button>`;

    let candidates: string;
    if (this.equipSlot === "units") {
      candidates =
        eq.units.map((u) => candRow(`remove:${u.id}`, `Remove ${u.name}`, "equipped", u.rarity)).join("") +
        inv
          .filter(isUnit)
          .map((u) => candRow(u.id, u.name, itemMeta(u), u.rarity))
          .join("");
    } else {
      const equipped = eq[this.equipSlot];
      candidates =
        (equipped ? candRow("remove", `Remove ${equipped.name}`, "equipped", equipped.rarity) : "") +
        inv
          .filter((i) => i.kind === this.equipSlot)
          .map((i) => candRow(i.id, i.name, itemMeta(i), i.rarity))
          .join("");
    }

    return `<div class="equip-grid">
      <div class="panel">
        <h3>Slots</h3>
        <div class="pso-menu">${slotRows}</div>
      </div>
      <div class="panel">
        <h3>${PANE_LABELS.equipment} — ${this.equipSlot}</h3>
        <div class="pso-menu shop-list">${candidates || `<div class="muted">Nothing equippable — visit the shops or send a run.</div>`}</div>
      </div>
      <div class="panel shop-detail">${this.equipDetail()}</div>
    </div>`;
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
    return `<div class="detail-name">${item.name}</div>
      <div class="muted" style="margin-bottom:8px">${itemMeta(item)}</div>
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

    const patternSel = q<HTMLSelectElement>("#pattern");
    patternSel?.addEventListener("change", () => {
      this.game.setPattern(PATTERN_PRESETS[patternSel.value] ?? this.game.selectedEntry().pattern);
      this.notice = "";
    });
    const areaSel = q<HTMLSelectElement>("#area");
    areaSel?.addEventListener("change", () => (this.areaSel = areaSel.value));
    const diffSel = q<HTMLSelectElement>("#difficulty");
    diffSel?.addEventListener("change", () => (this.diffSel = diffSel.value as DifficultyId));

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
      case "detail":
        this.detailId = id!;
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
        if (res.ok) this.equipCand = null;
        break;
      case "sell":
        res = this.game.sellInventoryItem(id!);
        if (res.ok && this.detailId === id) this.detailId = null;
        break;
      case "unequip":
        res = this.game.unequipToInventory(btn.dataset.slot as "weapon" | "frame" | "barrier");
        if (res.ok) this.equipCand = null;
        break;
      case "unequip-unit":
        res = this.game.unequipToInventory("unit", id);
        if (res.ok) this.equipCand = null;
        break;
      case "grind":
        res = this.game.grindEquippedWeapon();
        break;
      case "buy":
        res = this.game.buyConsumable(id as never, Number(btn.dataset.qty));
        break;
      case "buy-grinder":
        res = this.game.buyGrinders(Number(btn.dataset.qty));
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
        if (res.ok && this.detailId === id) this.detailId = null;
        break;
      case "apply-filter": {
        const below = Number(this.root.querySelector<HTMLInputElement>("#filter-below")!.value);
        const keepRare = this.root.querySelector<HTMLInputElement>("#filter-keep-rare")!.checked;
        this.game.setFilter({ autoSellBelow: below, alwaysKeep: keepRare ? ["rare"] : [] });
        break;
      }
    }

    if (!res.ok) this.flash(res.reason ?? "Action failed.");
    else this.render();
  }
}
