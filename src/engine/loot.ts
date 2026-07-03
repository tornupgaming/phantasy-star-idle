/**
 * Loot & economy (tasks 6.1–6.3).
 *
 * Authentic drop generation lives in drop-gen.ts. This module owns the economy
 * side that receives generated items: loot filtering, auto-sell, and inventory.
 */

import type { Item, Weapon, Frame, Barrier, Unit, Rarity } from "./items";
import { itemSellValue } from "./items";

/** A gear template = a gear item minus its instance `id` (minted on drop). */
export type GearTemplate =
  | Omit<Weapon, "id">
  | Omit<Frame, "id">
  | Omit<Barrier, "id">
  | Omit<Unit, "id">;

// ---- Loot filter (task 6.2) --------------------------------------------------

export interface LootFilter {
  /** Auto-sell kept items whose sell value is below this bar. */
  autoSellBelow: number;
  /** Rarities that are always kept regardless of value. */
  alwaysKeep: Rarity[];
}

/**
 * Default bar retuned for authentic sell values (authentic-drop-generation
 * 7.2): common drops sell for tens of meseta in the forest and low hundreds in
 * the mines, so 300 auto-sells the early-game flood while keeping mid-game
 * upgrades (~6 items per mines-normal run) and everything rare.
 */
export const DEFAULT_FILTER: LootFilter = { autoSellBelow: 300, alwaysKeep: ["rare"] };

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
