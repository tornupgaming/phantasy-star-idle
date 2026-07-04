/**
 * Authentic item pricing (item-pricing spec) — a port of newserv's
 * `ItemParameterTable::price_for_item` (src/ItemParameterTable.cc:2336-2410).
 *
 * Semantics preserved from the source:
 *  - Weapon math runs in floating point and truncates ONCE at the end
 *    (the C++ returns a size_t from a double expression).
 *  - Armor/shield math truncates the power term mid-formula (explicit
 *    static_cast<int32_t>) before adding the slot/level term.
 *  - Untekked weapons are flat 8; rare items are flat 80.
 *  - Sell-back anywhere in the game is `price >> 3` (src/Main.cc:2690).
 */

import type { Item, Weapon, Frame, Barrier, Unit, Tool } from "./items";
import { isTekked } from "./items";
import {
  SALE_DIVISORS,
  barrierDef,
  frameDef,
  specialDef,
  toolDef,
  weaponDef,
} from "./data/item-table";

/** Rare pricing threshold: 9+ base stars (matches get_item_adjusted_stars). */
function isRareForPricing(item: Item): boolean {
  return (item.stars ?? 0) >= 9;
}

function weaponPrice(item: Weapon): number {
  if (!isTekked(item)) return 8;
  if (isRareForPricing(item)) return 80;
  const def = item.code ? weaponDef(item.code) : null;
  if (!def || !def.saleDivisor) return 80; // unsellable divisor only occurs on rares
  const atpMax = def.atpMax + item.grind;
  const atpFactor = (atpMax * atpMax) / def.saleDivisor;
  // bonus_factor: +100 per bonus slot unconditionally (3 slots), plus the
  // bonus magnitude for slots with a valid type (1-5). Our keyed bonus model
  // only stores valid typed bonuses, so the base is a flat 300.
  const b = item.bonuses;
  const bonusFactor =
    300 + (b ? (b.native ?? 0) + (b.aBeast ?? 0) + (b.machine ?? 0) + (b.dark ?? 0) + (b.hit ?? 0) : 0);
  const specialStars = item.special !== undefined ? (specialDef(item.special)?.stars ?? 0) : 0;
  return Math.trunc(1000 * specialStars * specialStars + (atpFactor * bonusFactor) / 100);
}

function armorPrice(item: Frame | Barrier): number {
  if (isRareForPricing(item)) return 80;
  const isFrame = item.kind === "frame";
  const def = item.code ? (isFrame ? frameDef(item.code) : barrierDef(item.code)) : null;
  const divisor = isFrame ? SALE_DIVISORS.armor : SALE_DIVISORS.shield;
  // power_factor: dfp + evp including any variance rolled onto the instance.
  const power = item.dfp + item.evp;
  const powerFloor = Math.trunc((power * power) / divisor);
  const slots = (isFrame ? (item as Frame).unitSlots : item.slots) ?? 0;
  const requiredLevel = def?.requiredLevel ?? 0;
  return Math.trunc(powerFloor + 70 * (slots + 1) * (requiredLevel + 1));
}

function unitPrice(item: Unit): number {
  if (isRareForPricing(item)) return 80;
  // adjusted stars: base stars ±1 by unit-bonus sign; our unit instances have
  // no ± modifier variants, so adjusted = base.
  return Math.trunc((item.stars ?? 0) * SALE_DIVISORS.unit);
}

function toolPrice(item: Tool): number {
  const def = item.code ? toolDef(item.code) : null;
  if (!def) return item.sellValue << 3; // legacy tools round-trip their stored value
  // Tech disks: cost × disk level (cost × (data1[2]+1) in the source).
  if (item.tech !== undefined) return def.cost * (item.techLevel ?? 1);
  return def.cost;
}

/** Authentic buy price — what shops display and charge. */
export function priceForItem(item: Item): number {
  switch (item.kind) {
    case "weapon":
      return weaponPrice(item);
    case "frame":
    case "barrier":
      return armorPrice(item);
    case "unit":
      return unitPrice(item);
    case "tool":
      return toolPrice(item);
  }
}

/** Sell-back value: 1/8 of the buy price, truncated (price >> 3). */
export function sellPrice(item: Item): number {
  return priceForItem(item) >> 3;
}
