/**
 * Consumables + supply (tasks 5.1, 5.2).
 *
 * Two consumable kinds matter for the MVP survival loop: healing items (restore
 * HP) and revive items (restore the character on death). Grinders are also a
 * consumable-like stock but are spent in the meta layer (shop/grind), not in-run,
 * so they live in the player's grinder count, not the run supply.
 *
 * The player keeps a persistent stock; a run carries a *snapshot* of the stock it
 * was sent with and depletes only that snapshot (survival-consumables spec).
 */

export type ConsumableId =
  | "monomate"
  | "dimate"
  | "trimate"
  | "monofluid"
  | "difluid"
  | "trifluid"
  | "sol-atomizer"
  | "moon-atomizer"
  | "star-atomizer"
  | "antidote"
  | "antiparalysis"
  | "telepipe"
  | "trap-vision";

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  /**
   * "inert" entries are authentic tool-shop stock ingested ahead of their
   * systems (TP, status effects, traps): buyable, counted, sellable, but never
   * consumed by survival logic.
   */
  kind: "heal" | "revive" | "inert";
  /** HP restored (heal) or HP restored on revive. */
  amount: number;
  /** Authentic PSO item code (TTGGII); keys pricing and shop-table lookups. */
  code: string;
  price: number; // shop buy price in meseta
  sellValue: number;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  // Prices are the authentic PMT tool costs (item-pricing spec); sell = price >> 3.
  monomate: { id: "monomate", name: "Monomate", kind: "heal", amount: 90, code: "030000", price: 50, sellValue: 6 },
  dimate: { id: "dimate", name: "Dimate", kind: "heal", amount: 210, code: "030001", price: 300, sellValue: 37 },
  trimate: { id: "trimate", name: "Trimate", kind: "heal", amount: 480, code: "030002", price: 2000, sellValue: 250 },
  monofluid: { id: "monofluid", name: "Monofluid", kind: "inert", amount: 0, code: "030100", price: 100, sellValue: 12 },
  difluid: { id: "difluid", name: "Difluid", kind: "inert", amount: 0, code: "030101", price: 500, sellValue: 62 },
  trifluid: { id: "trifluid", name: "Trifluid", kind: "inert", amount: 0, code: "030102", price: 3600, sellValue: 450 },
  "sol-atomizer": { id: "sol-atomizer", name: "Sol Atomizer", kind: "inert", amount: 0, code: "030300", price: 300, sellValue: 37 },
  "moon-atomizer": {
    id: "moon-atomizer",
    name: "Moon Atomizer",
    kind: "revive",
    amount: 0, // full revive (see reviveHp)
    code: "030400",
    price: 500,
    sellValue: 62,
  },
  "star-atomizer": { id: "star-atomizer", name: "Star Atomizer", kind: "inert", amount: 0, code: "030500", price: 5000, sellValue: 625 },
  antidote: { id: "antidote", name: "Antidote", kind: "inert", amount: 0, code: "030600", price: 60, sellValue: 7 },
  antiparalysis: { id: "antiparalysis", name: "Antiparalysis", kind: "inert", amount: 0, code: "030601", price: 60, sellValue: 7 },
  telepipe: { id: "telepipe", name: "Telepipe", kind: "inert", amount: 0, code: "030700", price: 350, sellValue: 43 },
  "trap-vision": { id: "trap-vision", name: "Trap Vision", kind: "inert", amount: 0, code: "030800", price: 100, sellValue: 12 },
};

/** Consumable definitions as an ordered list (for shop / UI rendering). */
export const CONSUMABLES_LIST: ConsumableDef[] = Object.values(CONSUMABLES);

export function isInert(def: ConsumableDef): boolean {
  return def.kind === "inert";
}

/** Fraction of max HP restored on revive. */
export const REVIVE_HP_FRACTION = 0.5;

/** A stock of consumables keyed by id → count. */
export type Supply = Partial<Record<ConsumableId, number>>;

export function supplyCount(supply: Supply, id: ConsumableId): number {
  return supply[id] ?? 0;
}

export function addToSupply(supply: Supply, id: ConsumableId, n: number): void {
  supply[id] = supplyCount(supply, id) + n;
}

export function removeFromSupply(supply: Supply, id: ConsumableId, n: number): boolean {
  const have = supplyCount(supply, id);
  if (have < n) return false;
  supply[id] = have - n;
  return true;
}

/** Deep copy the supply for binding a snapshot to a run (task 5.2). */
export function cloneSupply(supply: Supply): Supply {
  return { ...supply };
}

export function isHeal(def: ConsumableDef): boolean {
  return def.kind === "heal";
}
export function isRevive(def: ConsumableDef): boolean {
  return def.kind === "revive";
}

/** Total heal amount available in a supply (used by prep-view estimates). */
export function totalHealAmount(supply: Supply): number {
  let total = 0;
  for (const id of Object.keys(supply) as ConsumableId[]) {
    const def = CONSUMABLES[id];
    if (def.kind === "heal") total += def.amount * supplyCount(supply, id);
  }
  return total;
}
