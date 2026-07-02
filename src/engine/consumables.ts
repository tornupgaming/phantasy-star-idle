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

export type ConsumableId = "monomate" | "dimate" | "trimate" | "moon-atomizer";

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  kind: "heal" | "revive";
  /** HP restored (heal) or HP restored on revive. */
  amount: number;
  price: number; // shop buy price in meseta
  sellValue: number;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  monomate: { id: "monomate", name: "Monomate", kind: "heal", amount: 90, price: 50, sellValue: 10 },
  dimate: { id: "dimate", name: "Dimate", kind: "heal", amount: 210, price: 150, sellValue: 30 },
  trimate: { id: "trimate", name: "Trimate", kind: "heal", amount: 480, price: 400, sellValue: 80 },
  "moon-atomizer": {
    id: "moon-atomizer",
    name: "Moon Atomizer",
    kind: "revive",
    amount: 0, // full revive (see reviveHp)
    price: 300,
    sellValue: 60,
  },
};

/** Consumable definitions as an ordered list (for shop / UI rendering). */
export const CONSUMABLES_LIST: ConsumableDef[] = [
  CONSUMABLES.monomate,
  CONSUMABLES.dimate,
  CONSUMABLES.trimate,
  CONSUMABLES["moon-atomizer"],
];

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
