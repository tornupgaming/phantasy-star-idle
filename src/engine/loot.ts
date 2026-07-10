/**
 * Loot & economy (tasks 6.1–6.3).
 *
 * Authentic drop generation lives in drop-gen.ts. This module owns the economy
 * side that receives generated items: loot filtering, auto-sell, and inventory.
 */

import type { Item, Weapon, Frame, Barrier, Unit, Rarity } from "./items";
import { sellPrice } from "./pricing";

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
 * Default bar retuned for authentic pricing (authentic-shop-inventory 4.4):
 * under price_for_item ÷ 8 sell values, mines-normal commons sell for
 * ~300-510, so 550 auto-sells the flood while keeping a handful of upgrades
 * per run and everything rare (balance-sim sweep).
 */
export const DEFAULT_FILTER: LootFilter = { autoSellBelow: 550, alwaysKeep: ["rare"] };

export type FilterDecision = "keep" | "sell";

export function filterItem(item: Item, filter: LootFilter): FilterDecision {
  if (filter.alwaysKeep.includes(item.rarity)) return "keep";
  return sellPrice(item) < filter.autoSellBelow ? "sell" : "keep";
}

// ---- Meseta + inventory (task 6.3) ------------------------------------------

export interface EconomyState {
  meseta: number;
  inventory: Item[];
  grinders: number;
}

export type InventorySaleResult = "sold" | "missing" | "locked";

export function sellFromInventory(state: EconomyState, itemId: string): InventorySaleResult {
  const idx = state.inventory.findIndex((i) => i.id === itemId);
  if (idx < 0) return "missing";
  if (state.inventory[idx].locked === true) return "locked";
  const [item] = state.inventory.splice(idx, 1);
  state.meseta += sellPrice(item);
  return "sold";
}

/** Sell every unlocked inventory item in one economy mutation. */
export function sellAllUnlockedFromInventory(state: EconomyState): number {
  const kept: Item[] = [];
  let sold = 0;
  for (const item of state.inventory) {
    if (item.locked === true) kept.push(item);
    else {
      state.meseta += sellPrice(item);
      sold += 1;
    }
  }
  state.inventory = kept;
  return sold;
}
