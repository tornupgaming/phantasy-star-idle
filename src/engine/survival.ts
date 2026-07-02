/**
 * In-run survival logic (tasks 5.3, 5.4 primitives).
 *
 * Pure functions the run loop calls: auto-heal when HP is low, auto-revive on
 * death when a revive remains. They mutate the run's supply snapshot and report
 * what happened so the battle log can record it. The ejection decision itself
 * (0 HP + no revive) is made by the run engine (task 5.4).
 */

import type { Supply, ConsumableId } from "./consumables";
import { CONSUMABLES, REVIVE_HP_FRACTION, removeFromSupply, supplyCount } from "./consumables";

export interface SurvivalConfig {
  /** Auto-heal when current HP ≤ this fraction of max HP. */
  healThresholdFraction: number;
}

// Authentic enemies can take ~half a low-level character's HP in one hit, so the
// default must heal above that point: at 0.65 a full-heal leaves no HP window
// where a single non-crit hit is lethal, without burning a heal on every chip hit.
export const DEFAULT_SURVIVAL: SurvivalConfig = { healThresholdFraction: 0.65 };

export interface HealEvent {
  itemId: ConsumableId;
  amount: number;
  newHp: number;
}

const HEAL_PRIORITY: ConsumableId[] = ["monomate", "dimate", "trimate"];

/** Whether HP is at/below the heal threshold. */
export function needsHeal(hp: number, maxHp: number, config: SurvivalConfig): boolean {
  return hp > 0 && hp <= maxHp * config.healThresholdFraction;
}

/**
 * Consume one healing item if any remain, restoring HP (capped at max). Chooses the
 * smallest heal that covers the deficit; otherwise the largest available (least
 * waste). Returns the event, or null if no heal was used.
 */
export function autoHeal(hp: number, maxHp: number, supply: Supply): HealEvent | null {
  const missing = maxHp - hp;
  const available = HEAL_PRIORITY.filter((id) => supplyCount(supply, id) > 0);
  if (available.length === 0) return null;

  // Ascending by heal amount.
  const sorted = [...available].sort((a, b) => CONSUMABLES[a].amount - CONSUMABLES[b].amount);
  const covering = sorted.find((id) => CONSUMABLES[id].amount >= missing);
  const chosen = covering ?? sorted[sorted.length - 1];

  removeFromSupply(supply, chosen, 1);
  const amount = CONSUMABLES[chosen].amount;
  const newHp = Math.min(maxHp, hp + amount);
  return { itemId: chosen, amount, newHp };
}

export interface ReviveEvent {
  itemId: ConsumableId;
  newHp: number;
}

/** Consume one revive item if any remain, restoring a fraction of max HP. */
export function autoRevive(maxHp: number, supply: Supply): ReviveEvent | null {
  const reviveId: ConsumableId = "moon-atomizer";
  if (supplyCount(supply, reviveId) <= 0) return null;
  removeFromSupply(supply, reviveId, 1);
  return { itemId: reviveId, newHp: Math.max(1, Math.round(maxHp * REVIVE_HP_FRACTION)) };
}
