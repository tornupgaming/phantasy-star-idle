/**
 * Loot & economy (tasks 6.1–6.3).
 *
 * Drop generation is seeded (design D2): every roll pulls from the run's RNG so a
 * replayed run yields identical drops. Each drop passes the player's loot filter,
 * which routes it to keep (→ inventory) or auto-sell (→ meseta). Grinders are a
 * distinct fungible currency-item; they drop as consumable-style entries too.
 */

import type { Rng } from "./rng";
import type { Item, Weapon, Frame, Barrier, Unit, Rarity } from "./items";
import { itemSellValue } from "./items";
import type { ConsumableId } from "./consumables";

/** A gear template = a gear item minus its instance `id` (minted on drop). */
export type GearTemplate =
  | Omit<Weapon, "id">
  | Omit<Frame, "id">
  | Omit<Barrier, "id">
  | Omit<Unit, "id">;

export type DropSpec =
  | { kind: "nothing" }
  | { kind: "meseta"; min: number; max: number }
  | { kind: "gear"; template: GearTemplate }
  | { kind: "consumable"; id: ConsumableId; min: number; max: number }
  | { kind: "grinder"; min: number; max: number };

export interface DropEntry {
  weight: number;
  spec: DropSpec;
}

/** A drop table has one weighted entry list per difficulty tier (0 = base). */
export interface DropTable {
  id: string;
  tiers: DropEntry[][];
}

/** A resolved drop before filtering. */
export interface DropOutcome {
  meseta: number;
  item: Item | null;
  consumable: { id: ConsumableId; count: number } | null;
  grinders: number;
}

const EMPTY_OUTCOME: DropOutcome = { meseta: 0, item: null, consumable: null, grinders: 0 };

function weightedPick(entries: DropEntry[], rng: Rng): DropEntry | null {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return null;
  let roll = rng.float(0, total);
  for (const e of entries) {
    roll -= e.weight;
    if (roll < 0) return e;
  }
  return entries[entries.length - 1];
}

/**
 * Roll a single drop from a table at a given tier. `mintId` produces the unique
 * instance id for gear (deterministic per run — pass a run-scoped counter).
 */
export function rollDrop(
  table: DropTable,
  tier: number,
  rng: Rng,
  mintId: () => string,
): DropOutcome {
  const entries = table.tiers[Math.min(tier, table.tiers.length - 1)] ?? [];
  const entry = weightedPick(entries, rng);
  if (!entry) return { ...EMPTY_OUTCOME };
  const spec = entry.spec;
  switch (spec.kind) {
    case "nothing":
      return { ...EMPTY_OUTCOME };
    case "meseta":
      return { ...EMPTY_OUTCOME, meseta: rng.int(spec.min, spec.max) };
    case "gear":
      return { ...EMPTY_OUTCOME, item: { ...(spec.template as GearTemplate), id: mintId() } as Item };
    case "consumable":
      return { ...EMPTY_OUTCOME, consumable: { id: spec.id, count: rng.int(spec.min, spec.max) } };
    case "grinder":
      return { ...EMPTY_OUTCOME, grinders: rng.int(spec.min, spec.max) };
  }
}

// ---- Loot filter (task 6.2) --------------------------------------------------

export interface LootFilter {
  /** Auto-sell kept-gear whose sell value is below this bar. */
  autoSellBelow: number;
  /** Rarities that are always kept regardless of value. */
  alwaysKeep: Rarity[];
}

export const DEFAULT_FILTER: LootFilter = { autoSellBelow: 100, alwaysKeep: ["rare"] };

export type FilterDecision = "keep" | "sell";

export function filterItem(item: Item, filter: LootFilter): FilterDecision {
  if (filter.alwaysKeep.includes(item.rarity)) return "keep";
  return itemSellValue(item) < filter.autoSellBelow ? "sell" : "keep";
}

// ---- Meseta + inventory (task 6.3) ------------------------------------------

export interface EconomyState {
  meseta: number;
  inventory: Item[];
  grinders: number;
}

export function sellFromInventory(state: EconomyState, itemId: string): boolean {
  const idx = state.inventory.findIndex((i) => i.id === itemId);
  if (idx < 0) return false;
  const [item] = state.inventory.splice(idx, 1);
  state.meseta += itemSellValue(item);
  return true;
}
