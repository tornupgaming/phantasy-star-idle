/**
 * Shop purchasing (task 6.4; add-character-roster group 5; pioneer2-hub-redesign).
 *
 * Spend meseta on consumables (healing/revive) and grinders — global, flat
 * prices — and on gear from two per-character stocks: the weapon shop and the
 * armour shop (frames, barriers, and units, as in PSO). Each stock is generated
 * deterministically from (shop kind, characterId, level band, restock counter)
 * via the seeded RNG and regenerates when the character's level band changes,
 * so offers stay relevant to that character's level (loot-economy spec).
 * Purchases are rejected when meseta is insufficient (no partial buys, no debt).
 * Authentic BB shop tables replace this generator with the drop-table port.
 */

import type { EconomyState, GearTemplate } from "./loot";
import type { Item } from "./items";
import type { Supply, ConsumableId } from "./consumables";
import { CONSUMABLES, addToSupply } from "./consumables";
import { createRng } from "./rng";
import { GEAR } from "./content";

export const GRINDER_PRICE = 200;

/** Shops sell gear at a markup over its sell value. */
export const GEAR_PRICE_MULT = 3;

/** Number of gear offers a stock holds when the pool allows. */
export const STOCK_SIZE = 4;

/** Level band: 0 = levels 1–5, 1 = 6–10, … Stock regenerates on band change. */
export function levelBand(level: number): number {
  return Math.floor((Math.max(1, level) - 1) / 5);
}

/** The two gear counters on Pioneer 2. */
export type ShopKind = "weapon" | "armour";

/** A character's current gear stock for one shop kind. */
export interface ShopStock {
  band: number;
  restock: number; // increments on every regeneration → fresh RNG stream
  offers: Item[];
}

/**
 * Gear each shop may offer, gated by the buyer's level band. The armour shop
 * carries frames, barriers, and units (PSO-authentic); each kind keeps at
 * least two band-0 templates so early shops are not empty.
 */
const SHOP_POOLS: Record<ShopKind, Array<{ template: GearTemplate; minBand: number }>> = {
  weapon: [
    { template: GEAR.handBlade, minBand: 0 },
    { template: GEAR.ironSaber, minBand: 0 },
    { template: GEAR.scoutRifle, minBand: 1 },
    { template: GEAR.greatBlade, minBand: 2 },
  ],
  armour: [
    { template: GEAR.clothArmor, minBand: 0 },
    { template: GEAR.woodShield, minBand: 0 },
    { template: GEAR.plateArmor, minBand: 1 },
    { template: GEAR.powerUnit, minBand: 1 },
    { template: GEAR.guardUnit, minBand: 1 },
    { template: GEAR.hitUnit, minBand: 2 },
  ],
};

/**
 * Deterministic gear stock: same (kind, characterId, band, restock) always
 * yields the same offers, and the two kinds draw independent RNG streams.
 * Draws distinct templates from the band-eligible pool.
 */
export function generateGearStock(
  characterId: string,
  kind: ShopKind,
  band: number,
  restock: number,
): ShopStock {
  const rng = createRng(`shop-${kind}-${characterId}-${band}`, restock);
  const eligible = SHOP_POOLS[kind].filter((p) => p.minBand <= band).map((p) => p.template);
  const offers: Item[] = [];
  const remaining = [...eligible];
  for (let i = 0; i < STOCK_SIZE && remaining.length > 0; i++) {
    const idx = rng.int(0, remaining.length - 1);
    const [template] = remaining.splice(idx, 1);
    offers.push({ ...template, id: `shop-${kind}-${characterId}-${band}-${restock}-${i}` } as Item);
  }
  return { band, restock, offers };
}

export function gearPrice(item: Item): number {
  return item.sellValue * GEAR_PRICE_MULT;
}

/**
 * Buy a gear offer: deducts shared meseta, moves the item to the shared
 * inventory, and removes the offer from the stock.
 */
export function buyGear(economy: EconomyState, stock: ShopStock, offerId: string): PurchaseResult {
  const idx = stock.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) return { ok: false, reason: "no such offer" };
  const item = stock.offers[idx];
  const cost = gearPrice(item);
  if (economy.meseta < cost) return { ok: false, reason: "insufficient meseta" };
  economy.meseta -= cost;
  stock.offers.splice(idx, 1);
  economy.inventory.push(item);
  return { ok: true, spent: cost };
}

export type PurchaseResult = { ok: true; spent: number } | { ok: false; reason: string };

export function buyConsumable(
  economy: EconomyState,
  supply: Supply,
  id: ConsumableId,
  quantity: number,
): PurchaseResult {
  if (quantity <= 0) return { ok: false, reason: "quantity must be positive" };
  const cost = CONSUMABLES[id].price * quantity;
  if (economy.meseta < cost) return { ok: false, reason: "insufficient meseta" };
  economy.meseta -= cost;
  addToSupply(supply, id, quantity);
  return { ok: true, spent: cost };
}

export function buyGrinders(economy: EconomyState, quantity: number): PurchaseResult {
  if (quantity <= 0) return { ok: false, reason: "quantity must be positive" };
  const cost = GRINDER_PRICE * quantity;
  if (economy.meseta < cost) return { ok: false, reason: "insufficient meseta" };
  economy.meseta -= cost;
  economy.grinders += quantity;
  return { ok: true, spent: cost };
}
