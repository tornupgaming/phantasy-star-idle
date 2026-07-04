/**
 * Game orchestration + persistence (tasks 7.1, 7.4, 9.3).
 *
 * Owns the persistent GameState and the meta-layer operations the UI drives:
 * equip/grind/buy/sell, and send/poll for runs. The wall clock is *injected*
 * (`now()`) rather than read here, so this file stays free of `Date.now()` and the
 * seeded-replay boundary (design D2) is preserved — only main.ts binds `Date.now`.
 *
 * A run is created as a full input snapshot at "send" (7.1). Progress is derived by
 * re-simulating that snapshot and revealing events up to the elapsed game time
 * (7.4) — the same code path serves a live tick and an offline resume, because the
 * simulation never reads the clock. Because runs never auto-restart (survival D7),
 * offline accrual is inherently bounded to a single run; a cap guards the rest (9.3).
 */

import type { Character } from "./character";
import {
  effectiveStats,
  applyRunXp,
  emptyEquipment,
  equip,
  unequip,
  grindWeapon,
  unitCapacity,
} from "./character";
import { SECTION_IDS, CLASS_BY_ID, LEVEL_CAP, type SectionId } from "./classes";
import { sectionIdFromName, statsAtLevel, xpForLevel } from "./progression";
import type { Stats } from "./stats";
import type { Item, Weapon, Frame, Barrier, Unit } from "./items";
import { isWeapon, isFrame, isBarrier, isUnit } from "./items";
import type { EconomyState, LootFilter } from "./loot";
import { sellFromInventory, DEFAULT_FILTER } from "./loot";
import type { Supply, ConsumableId } from "./consumables";
import { addToSupply, cloneSupply } from "./consumables";
import {
  buyConsumable,
  buyGrinders,
  buyGear,
  buyToolItem,
  generateGearStock,
  generateToolStock,
  type ShopKind,
  type ShopStock,
  type ToolShopStock,
} from "./shop";
import type { AttackType } from "./combat";
import type { DifficultyId } from "./areas";
import { getArea, startingCharacter, startingEconomy, startingSupply } from "./content";
import { difficulty } from "./areas";
import {
  simulateRun,
  revealUpTo,
  isRunFinished,
  GAME_SPEED,
  type RunInput,
  type RunResult,
  type RunEvent,
} from "./run";
import { SaveManager, type StoragePort } from "./save";
import { DEFAULT_SURVIVAL, type SurvivalConfig } from "./survival";

/** Cap on offline catch-up: game ms credited for a single absence (9.3). */
export const OFFLINE_CAP_MS = 12 * 60 * 60 * 1000;

export interface ActiveRun {
  input: RunInput;
  startedAtWall: number; // wall-clock epoch ms at send
}

export interface RunReport {
  characterName: string;
  areaName: string;
  difficultyLabel: string;
  outcome: "complete" | "ejected";
  roomsCleared: number;
  totalRooms: number;
  meseta: number;
  items: Item[];
  consumablesGained: Supply;
  consumablesUsed: Supply;
  grinders: number;
  xpGained: number;
  levelsGained: number;
  /** The dispatched character's level after applying the run's XP. */
  level: number;
}

/**
 * A roster character plus its per-character run configuration. Loot filter,
 * attack pattern, and survival rules describe how *that* character runs;
 * inventory, meseta, and consumable supply stay account-wide (loot-economy spec).
 */
/** One stock per Pioneer 2 counter (authentic-shop-inventory). */
export interface ShopStocks {
  weapon: ShopStock;
  armour: ShopStock;
  tool: ToolShopStock;
}

export interface RosterEntry {
  character: Character;
  filter: LootFilter;
  pattern: AttackType[];
  survival: SurvivalConfig;
  /** Per-character gear stocks, regenerated when the level band changes. */
  shop: ShopStocks;
}

export interface GameState {
  roster: RosterEntry[];
  selectedCharacterId: string;
  charCounter: number; // mints unique character ids
  economy: EconomyState; // shared: meseta + inventory
  supply: Supply; // shared: persistent consumable stock
  runCounter: number;
  activeRun: ActiveRun | null; // single global run slot across the roster
  lastReport: RunReport | null;
}

export interface RunProgress {
  areaName: string;
  difficultyLabel: string;
  gameTime: number;
  endTime: number;
  finished: boolean;
  outcome: "complete" | "ejected";
  revealedEvents: RunEvent[];
  /**
   * The stage's planned room count, from the pre-rolled stage layout. Always
   * the full plan, even when the result ends in defeat before the last room —
   * safe to show before the run settles (no outcome leak).
   */
  totalRooms: number;
  /** The generated stage's per-room plan (settlement report only; truncated on defeat — an outcome oracle, so the stage UI must not read it). */
  roomPlan: { enemies: number; boxes: number }[];
}

export type ActionResult = { ok: true } | { ok: false; reason: string };

/** Fresh weapon + armour stocks for a character at its current band. */
function freshShopStocks(character: Character): ShopStocks {
  return {
    weapon: generateGearStock(character.id, "weapon", character.level, character.sectionId),
    armour: generateGearStock(character.id, "armour", character.level, character.sectionId),
    tool: generateToolStock(character.id, character.level),
  };
}

/** A fresh roster entry with default run configuration and level-1 shop stocks. */
function newEntry(character: Character): RosterEntry {
  return {
    character,
    filter: { ...DEFAULT_FILTER },
    pattern: ["normal", "normal", "heavy"],
    survival: { ...DEFAULT_SURVIVAL },
    shop: freshShopStocks(character),
  };
}

function newGameState(): GameState {
  const character = startingCharacter();
  const state: GameState = {
    roster: [newEntry(character)],
    selectedCharacterId: character.id,
    charCounter: 1,
    economy: startingEconomy(),
    supply: startingSupply(),
    runCounter: 0,
    activeRun: null,
    lastReport: null,
  };
  autoEquipStarter(state);
  return state;
}

/** Equip the starter gear from inventory so the first run is immediately playable. */
function autoEquipStarter(state: GameState): void {
  const inv = state.economy.inventory;
  const character = state.roster[0].character;
  const take = (pred: (i: Item) => boolean) => {
    const idx = inv.findIndex(pred);
    return idx >= 0 ? inv.splice(idx, 1)[0] : null;
  };
  const w = take(isWeapon);
  if (w) equip(character, w as Weapon);
  const f = take(isFrame);
  if (f) equip(character, f as Frame);
  const b = take(isBarrier);
  if (b) equip(character, b as Barrier);
}

/**
 * Save migrations. v1 → v2 (character-roster spec): the legacy single character
 * becomes roster slot 1 as a HUmar with a section ID derived from its name, at
 * the lowest level whose derived stats do not fall below the legacy flat base
 * stats (LCK is excluded — it never grows). Equipment and the shared economy
 * carry over; any in-flight run is dropped (its snapshot uses the old stat
 * model and could not replay faithfully). v2 → v3 (pioneer2-hub-redesign): the
 * single mixed gear stock per roster entry becomes separate weapon/armour
 * stocks, regenerated fresh at the character's current band — stock is
 * ephemeral by design (it already rerolls on band change) and offers are
 * unpurchased shop copies, so nothing player-owned is lost. v3 → v4
 * (authentic-drop-generation): items gained optional generated-variance fields
 * (bonuses/special/slots/stars/code) — absent on old items by design, nothing
 * to stamp — but v3 shop stocks hold copies of the removed placeholder GEAR
 * templates, so stocks are regenerated from the authentic templates.
 * Player-owned legacy items (inventory + equipped) are self-contained and
 * survive as-is.
 */
export function migrateSave(version: number, old: unknown): GameState | null {
  if (version === 4) return migrateV4(old);
  if (version === 3) return migrateV3(old);
  if (version === 2) return migrateV2(old); // its fresh stocks already use the authentic templates
  if (version === 1) {
    const v2 = migrateV1(old);
    return v2 ? migrateV2(v2) : null;
  }
  return null;
}

/**
 * v4 → v5: shop stocks change shape ({band, restock} → {level}) and gain the
 * tool counter — stock is ephemeral by design, so regenerate it. Player-owned
 * items are untouched (tekked/tech fields are optional and default sensibly).
 */
function migrateV4(old: unknown): GameState | null {
  return migrateV2(old); // same operation: fresh stocks per roster entry
}

/** v3 → v4: purge placeholder-template shop offers by regenerating every stock. */
function migrateV3(old: unknown): GameState | null {
  return migrateV2(old); // same operation: fresh split stocks per roster entry
}

/** v2 → v3: replace each entry's mixed `shop` stock with fresh split stocks. */
function migrateV2(old: unknown): GameState | null {
  if (old == null || typeof old !== "object") return null;
  const state = old as GameState;
  if (!Array.isArray(state.roster) || state.roster.length === 0) return null;
  for (const entry of state.roster) {
    entry.shop = freshShopStocks(entry.character);
  }
  return state;
}

function migrateV1(old: unknown): GameState | null {
  if (old == null || typeof old !== "object") return null;
  const legacy = old as {
    character: { name: string; baseStats: Stats; equipment: Character["equipment"] };
    economy: EconomyState;
    supply: Supply;
    filter: LootFilter;
    pattern: AttackType[];
    survival: SurvivalConfig;
    runCounter: number;
  };
  if (!legacy.character || !legacy.economy) return null;

  const classId = "humar";
  const target = legacy.character.baseStats;
  const matchesAt = (level: number): boolean => {
    const s = statsAtLevel(classId, level);
    return (
      s.atp >= target.atp &&
      s.dfp >= target.dfp &&
      s.ata >= target.ata &&
      s.evp >= target.evp &&
      s.mst >= target.mst &&
      s.hp >= target.hp
    );
  };
  let level = LEVEL_CAP;
  for (let l = 1; l <= LEVEL_CAP; l++) {
    if (matchesAt(l)) {
      level = l;
      break;
    }
  }

  const character: Character = {
    id: "char-1",
    name: legacy.character.name || "Hunter",
    classId,
    sectionId: sectionIdFromName(legacy.character.name || "Hunter"),
    level,
    xp: xpForLevel(classId, level), // keep xp consistent so future level-ups work
    equipment: legacy.character.equipment ?? emptyEquipment(),
  };
  return {
    roster: [
      {
        character,
        filter: legacy.filter ?? { ...DEFAULT_FILTER },
        pattern: legacy.pattern?.length ? legacy.pattern : ["normal", "normal", "heavy"],
        survival: legacy.survival ?? { ...DEFAULT_SURVIVAL },
        shop: freshShopStocks(character),
      },
    ],
    selectedCharacterId: character.id,
    charCounter: 1,
    economy: legacy.economy,
    supply: legacy.supply ?? {},
    runCounter: legacy.runCounter ?? 0,
    activeRun: null,
    lastReport: null,
  };
}

export class Game {
  private saver: SaveManager<GameState>;
  private cachedResult: RunResult | null = null;
  private cachedRunId: string | null = null;

  constructor(
    storage: StoragePort,
    private now: () => number,
    public state: GameState,
  ) {
    this.saver = new SaveManager<GameState>(storage);
  }

  /** Load an existing save (resuming any active run) or start a fresh game. */
  static loadOrNew(storage: StoragePort, now: () => number): Game {
    const saver = new SaveManager<GameState>(storage);
    const env = saver.load(migrateSave);
    const state = env ? env.state : newGameState();
    const game = new Game(storage, now, state);
    if (!env || env.migrated) game.save(); // persist fresh states and migrations
    return game;
  }

  save(): void {
    this.saver.save(this.state, this.now());
  }

  // ---- Roster (character-roster spec) ----------------------------------------

  private entryById(id: string): RosterEntry | undefined {
    return this.state.roster.find((e) => e.character.id === id);
  }

  /** The roster entry for the selected character (always exists). */
  selectedEntry(): RosterEntry {
    const entry = this.entryById(this.state.selectedCharacterId);
    if (!entry) throw new Error("no selected character"); // invariant: roster is never empty
    return entry;
  }

  /** The selected character — the one that equips, shops, and runs. */
  selectedCharacter(): Character {
    return this.selectedEntry().character;
  }

  /**
   * Create a roster character. Section ID defaults to the derive-from-name
   * algorithm when not overridden; class and section ID are immutable afterward.
   */
  createCharacter(name: string, classId: string, sectionId?: SectionId): ActionResult {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, reason: "name must not be empty" };
    if (!CLASS_BY_ID[classId]) return { ok: false, reason: "unknown class" };
    if (sectionId !== undefined && !SECTION_IDS.includes(sectionId)) {
      return { ok: false, reason: "unknown section ID" };
    }
    const character: Character = {
      id: `char-${++this.state.charCounter}`,
      name: trimmed,
      classId,
      sectionId: sectionId ?? sectionIdFromName(trimmed),
      level: 1,
      xp: 0,
      equipment: emptyEquipment(),
    };
    this.state.roster.push(newEntry(character));
    this.save();
    return { ok: true };
  }

  /** Switch the selected character. Locked while a run is active. */
  selectCharacter(id: string): ActionResult {
    if (this.state.activeRun) {
      return { ok: false, reason: "cannot switch characters during a run" };
    }
    if (!this.entryById(id)) return { ok: false, reason: "no such character" };
    this.state.selectedCharacterId = id;
    this.save();
    return { ok: true };
  }

  /**
   * Delete a roster character: its equipped items return to the shared
   * inventory first. The last character and the running character are protected.
   */
  deleteCharacter(id: string): ActionResult {
    const entry = this.entryById(id);
    if (!entry) return { ok: false, reason: "no such character" };
    if (this.state.roster.length <= 1) {
      return { ok: false, reason: "cannot delete the last character" };
    }
    if (this.state.activeRun && this.state.activeRun.input.character.id === id) {
      return { ok: false, reason: "cannot delete a character on a run" };
    }
    const eq = entry.character.equipment;
    for (const item of [eq.weapon, eq.frame, eq.barrier, ...eq.units]) {
      if (item) this.inv().push(item);
    }
    this.state.roster = this.state.roster.filter((e) => e !== entry);
    if (this.state.selectedCharacterId === id) {
      this.state.selectedCharacterId = this.state.roster[0].character.id;
    }
    this.save();
    return { ok: true };
  }

  // ---- Equipment ------------------------------------------------------------

  private inv(): Item[] {
    return this.state.economy.inventory;
  }

  equipFromInventory(itemId: string): ActionResult {
    if (this.state.activeRun) return { ok: false, reason: "cannot change gear during a run" };
    const idx = this.inv().findIndex((i) => i.id === itemId);
    if (idx < 0) return { ok: false, reason: "item not in inventory" };
    const item = this.inv()[idx];
    const eq = this.selectedCharacter().equipment;

    if (isUnit(item)) {
      if (eq.units.length >= unitCapacity(eq)) {
        return { ok: false, reason: unitCapacity(eq) === 0 ? "no frame equipped" : "no free unit slot" };
      }
      this.inv().splice(idx, 1);
      equip(this.selectedCharacter(), item as Unit);
    } else if (isWeapon(item)) {
      const old = unequip(this.selectedCharacter(), "weapon");
      this.inv().splice(idx, 1);
      equip(this.selectedCharacter(), item as Weapon);
      if (old) this.inv().push(old);
    } else if (isFrame(item)) {
      const oldUnits = [...eq.units];
      const old = unequip(this.selectedCharacter(), "frame");
      this.inv().splice(idx, 1);
      equip(this.selectedCharacter(), item as Frame);
      if (old) this.inv().push(old);
      // Return any units the smaller frame could not keep.
      for (const u of oldUnits.slice(eq.units.length)) this.inv().push(u);
    } else if (isBarrier(item)) {
      const old = unequip(this.selectedCharacter(), "barrier");
      this.inv().splice(idx, 1);
      equip(this.selectedCharacter(), item as Barrier);
      if (old) this.inv().push(old);
    } else {
      // Inert tool items are sellable but never equippable (loot-economy spec).
      return { ok: false, reason: "cannot be equipped" };
    }
    this.save();
    return { ok: true };
  }

  unequipToInventory(slot: "weapon" | "frame" | "barrier" | "unit", unitId?: string): ActionResult {
    if (this.state.activeRun) return { ok: false, reason: "cannot change gear during a run" };
    const eq = this.selectedCharacter().equipment;
    let removed: Item | null;
    if (slot === "unit") {
      removed = unequip(this.selectedCharacter(), "unit", unitId ?? "");
    } else {
      removed = unequip(this.selectedCharacter(), slot);
    }
    if (!removed) return { ok: false, reason: "nothing equipped in that slot" };
    this.inv().push(removed);
    if (slot === "frame") {
      // Units mount on the frame: removing it returns them too (PSO semantics,
      // and keeps the committed action consistent with previewStats).
      for (const u of eq.units.splice(0)) this.inv().push(u);
    }
    this.save();
    return { ok: true };
  }

  grindEquippedWeapon(): ActionResult {
    if (this.state.activeRun) return { ok: false, reason: "cannot grind during a run" };
    const w = this.selectedCharacter().equipment.weapon;
    if (!w) return { ok: false, reason: "no weapon equipped" };
    if (this.state.economy.grinders <= 0) return { ok: false, reason: "no grinders" };
    const res = grindWeapon(w);
    if (!res.ok) return res;
    this.state.economy.grinders -= 1;
    this.save();
    return { ok: true };
  }

  sellInventoryItem(itemId: string): ActionResult {
    if (!sellFromInventory(this.state.economy, itemId)) {
      return { ok: false, reason: "item not in inventory" };
    }
    this.save();
    return { ok: true };
  }

  // ---- Shop -----------------------------------------------------------------

  buyConsumable(id: ConsumableId, quantity: number): ActionResult {
    const r = buyConsumable(this.state.economy, this.state.supply, id, quantity);
    if (r.ok) this.save();
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  }

  buyGrinders(quantity: number): ActionResult {
    const r = buyGrinders(this.state.economy, quantity);
    if (r.ok) this.save();
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  }

  /**
   * The selected character's gear stock for one counter, regenerated first if
   * the character leveled since the stock was produced (shop-generation spec:
   * stock is a pure function of (kind, characterId, level)).
   */
  shopStock(kind: Exclude<ShopKind, "tool">): ShopStock {
    const entry = this.selectedEntry();
    const { character } = entry;
    if (entry.shop[kind].level !== character.level) {
      entry.shop[kind] = generateGearStock(character.id, kind, character.level, character.sectionId);
      this.save();
    }
    return entry.shop[kind];
  }

  /** The selected character's tool-counter stock, regenerated on level change. */
  toolShopStock(): ToolShopStock {
    const entry = this.selectedEntry();
    const { character } = entry;
    if (entry.shop.tool.level !== character.level) {
      entry.shop.tool = generateToolStock(character.id, character.level);
      this.save();
    }
    return entry.shop.tool;
  }

  /** Buy a gear offer from one of the selected character's shops into the shared inventory. */
  buyGearFromShop(kind: Exclude<ShopKind, "tool">, offerId: string): ActionResult {
    const r = buyGear(this.state.economy, this.shopStock(kind), offerId);
    if (r.ok) this.save();
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  }

  /** Buy a one-shot tool-counter item (tech disk, Scape Doll) into inventory. */
  buyToolItemFromShop(itemId: string): ActionResult {
    const r = buyToolItem(this.state.economy, this.toolShopStock(), itemId);
    if (r.ok) this.save();
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  }

  // ---- Config ---------------------------------------------------------------

  setPattern(pattern: AttackType[]): void {
    if (pattern.length > 0) this.selectedEntry().pattern = pattern;
    this.save();
  }

  setFilter(filter: LootFilter): void {
    this.selectedEntry().filter = filter;
    this.save();
  }

  // ---- Runs (task 7.1) ------------------------------------------------------

  /** Send the character on a run. Enforces a single active run and snapshots state. */
  sendRun(areaId: string, difficultyId: DifficultyId): ActionResult {
    if (this.state.activeRun) return { ok: false, reason: "a run is already active" };
    const entry = this.selectedEntry();
    if (!entry.character.equipment.weapon) return { ok: false, reason: "equip a weapon first" };
    getArea(areaId); // validate

    const n = ++this.state.runCounter;
    const runId = `run-${n}`;
    const seed = (n * 48271) % 2147483647;

    const input: RunInput = {
      runId,
      seed,
      areaId,
      difficultyId,
      character: structuredClone(entry.character), // snapshot; stats stay frozen mid-run
      supply: cloneSupply(this.state.supply), // snapshot bound to the run
      filter: structuredClone(entry.filter),
      pattern: [...entry.pattern],
      survival: { ...entry.survival },
    };
    this.state.activeRun = { input, startedAtWall: this.now() };
    this.cachedResult = null;
    this.cachedRunId = null;
    this.save();
    return { ok: true };
  }

  private resultFor(run: ActiveRun): RunResult {
    if (this.cachedResult && this.cachedRunId === run.input.runId) return this.cachedResult;
    this.cachedResult = simulateRun(run.input);
    this.cachedRunId = run.input.runId;
    return this.cachedResult;
  }

  /** Elapsed game time for the active run, clamped by the offline cap (9.3). */
  private elapsedGameTime(run: ActiveRun): number {
    const wall = Math.max(0, this.now() - run.startedAtWall);
    return Math.min(wall * GAME_SPEED, OFFLINE_CAP_MS);
  }

  /** Current progress of the active run, or null if none. Does not settle. */
  runProgress(): RunProgress | null {
    const run = this.state.activeRun;
    if (!run) return null;
    const result = this.resultFor(run);
    const gameTime = this.elapsedGameTime(run);
    return {
      areaName: getArea(run.input.areaId).name,
      difficultyLabel: difficulty(run.input.difficultyId).label,
      gameTime,
      endTime: result.endTime,
      finished: isRunFinished(result, gameTime),
      outcome: result.outcome,
      revealedEvents: revealUpTo(result, gameTime),
      totalRooms: result.totalRooms,
      roomPlan: result.roomPlan,
    };
  }

  /**
   * Advance the clock; if the active run has fully played out, settle it (commit
   * loot + meseta, deplete used consumables, produce a report). Returns true if a
   * run just settled. Safe to call every tick and on load (7.4).
   */
  poll(): boolean {
    const run = this.state.activeRun;
    if (!run) return false;
    const result = this.resultFor(run);
    if (!isRunFinished(result, this.elapsedGameTime(run))) return false;
    this.settle(result);
    return true;
  }

  private settle(result: RunResult): void {
    const econ = this.state.economy;
    econ.meseta += result.loot.meseta;
    econ.grinders += result.loot.grinders;
    for (const item of result.loot.items) econ.inventory.push(item);
    // Deplete consumables actually used; credit consumables gained as loot.
    for (const id of Object.keys(result.consumablesUsed) as ConsumableId[]) {
      const used = result.consumablesUsed[id] ?? 0;
      this.state.supply[id] = Math.max(0, (this.state.supply[id] ?? 0) - used);
    }
    for (const id of Object.keys(result.loot.consumables) as ConsumableId[]) {
      addToSupply(this.state.supply, id, result.loot.consumables[id] ?? 0);
    }
    // XP goes to the character that was dispatched (it cannot be deleted while
    // running, so the entry exists); level-ups apply only here, at resolution.
    const dispatchedId = this.state.activeRun!.input.character.id;
    const dispatched = this.entryById(dispatchedId)!.character;
    const { levelsGained } = applyRunXp(dispatched, result.xpGained);
    this.state.lastReport = {
      characterName: dispatched.name,
      areaName: getArea(result.areaId).name,
      difficultyLabel: difficulty(result.difficultyId).label,
      outcome: result.outcome,
      roomsCleared: result.roomsCleared,
      totalRooms: result.totalRooms,
      meseta: result.loot.meseta,
      items: result.loot.items,
      consumablesGained: result.loot.consumables,
      consumablesUsed: result.consumablesUsed,
      grinders: result.loot.grinders,
      xpGained: result.xpGained,
      levelsGained,
      level: dispatched.level,
    };
    this.state.activeRun = null;
    this.cachedResult = null;
    this.cachedRunId = null;
    this.save();
  }

  /** Effective (in-combat) stats of the selected character, for display. */
  effectiveStats() {
    return effectiveStats(this.selectedCharacter());
  }
}
