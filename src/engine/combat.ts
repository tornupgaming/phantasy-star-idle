/**
 * Combat resolution — the PSO per-attack pipeline (tasks 3.1–3.5).
 *
 * Every random draw comes from the run's seeded RNG so the exchange is replayable
 * (design D2). The pipeline is symmetric: enemy→character attacks run the exact
 * same functions in reverse (enemy ATP vs. character DFP, enemy crit rate).
 *
 * Formula references (combat-resolution spec / design D3):
 *   hit accuracy  = ATAeff − EVPeff×0.2,  ATAeff = ATA × attackTypeAcc × comboStepAcc
 *   crit rate     = min(LCK,100)/5 % (character), min(LCK,100)/2 % (enemy); ×1.5 dmg
 *   damage        = ⌊ (ATPeff − DFPeff)/5 × 0.9 × attackTypeDmg ⌋   (truncate, floor 0)
 *   ATPeff        = [BaseATP + Wvar×WSpread]×(1+SA) + EQATP + Pvar
 *   EQATP         = WATP,min×(1+Watr) + Grind×2 + FATP + BaATP   (attribute on min ATP only)
 *   DFPeff        = DFPbase × (1 − ZL)
 */

import type { Rng } from "./rng";

export type AttackType = "normal" | "heavy" | "special";

/** Accuracy and damage modifiers per attack type (authored balance values, design D4). */
export const ATTACK_TYPE_MOD: Record<AttackType, { acc: number; dmg: number }> = {
  normal: { acc: 1.0, dmg: 1.0 },
  heavy: { acc: 0.7, dmg: 1.89 }, // hard attack: less accurate, hits much harder
  special: { acc: 0.5, dmg: 1.0 }, // reserved; not used by MVP patterns
};

/** Combo-step accuracy multipliers for the 1st/2nd/3rd attack (spec 3.1). */
export const COMBO_STEP_ACC = [1.0, 1.3, 1.69] as const;
export const COMBO_LENGTH = COMBO_STEP_ACC.length;

export const CRIT_MULTIPLIER = 1.5;

/** Shifta (SA) and Zalure (ZL) buffs are deferred (techniques out of scope) → 0. */
const SA = 0;
const ZL = 0;

/**
 * A participant in combat. `atp/dfp/ata/evp/lck` are effective stats. The weapon
 * terms feed EQATP; enemies leave them 0 (`eqAtp` = 0, `spread` = their damage
 * spread). `pvarMax` is the profession/enemy variance range (Pvar drawn 0..pvarMax).
 * `critDivisor` is 5 for the character, 2 for enemies.
 */
export interface Combatant {
  name: string;
  atp: number; // BaseATP
  dfp: number;
  ata: number;
  evp: number;
  lck: number;
  eqAtp: number; // EQATP (0 for enemies)
  spread: number; // WSpread (weapon spread; enemy damage spread)
  pvarMax: number; // profession/enemy variance range
  critDivisor: number; // 5 = character, 2 = enemy
}

export interface AttackOutcome {
  hit: boolean;
  crit: boolean;
  damage: number;
  accuracy: number; // computed accuracy % (for logging/tests)
}

/** ATAeff and resulting accuracy % for a given attack type + combo step. */
export function computeAccuracy(
  attacker: Combatant,
  defender: Combatant,
  attackType: AttackType,
  comboStep: number,
): number {
  const comboAcc = COMBO_STEP_ACC[comboStep % COMBO_LENGTH];
  const ataEff = attacker.ata * ATTACK_TYPE_MOD[attackType].acc * comboAcc;
  return ataEff - defender.evp * 0.2;
}

/** Resolve whether the attack lands. ≥100% always hits; negative always misses. */
export function rollHit(accuracy: number, rng: Rng): boolean {
  if (accuracy >= 100) return true;
  if (accuracy < 0) return false;
  return rng.chance(accuracy / 100);
}

/** Roll a critical using the attacker's crit divisor. */
export function rollCrit(attacker: Combatant, rng: Rng): boolean {
  const rate = Math.min(attacker.lck, 100) / attacker.critDivisor; // percent
  return rng.chance(rate / 100);
}

/**
 * Physical damage. Draws Wvar (0..1) and Pvar (0..pvarMax) from the seeded RNG so
 * repeated identical attacks vary. Applies the hard 0-damage floor when
 * ATPeff ≤ DFPeff (design D6), truncates (never rounds), and never goes negative.
 */
export function computeDamage(
  attacker: Combatant,
  defender: Combatant,
  attackType: AttackType,
  crit: boolean,
  rng: Rng,
): number {
  const wvar = rng.next(); // 0..1
  const pvar = attacker.pvarMax > 0 ? rng.int(0, attacker.pvarMax) : 0;

  const atpEff = (attacker.atp + wvar * attacker.spread) * (1 + SA) + attacker.eqAtp + pvar;
  const dfpEff = defender.dfp * (1 - ZL);

  if (atpEff <= dfpEff) return 0; // hard difficulty wall — no min-1 rule

  let raw = ((atpEff - dfpEff) / 5) * 0.9 * ATTACK_TYPE_MOD[attackType].dmg;
  if (crit) raw *= CRIT_MULTIPLIER;
  return Math.max(0, Math.floor(raw));
}

/** Full per-attack resolution: hit → crit → damage. */
export function resolveAttack(
  attacker: Combatant,
  defender: Combatant,
  attackType: AttackType,
  comboStep: number,
  rng: Rng,
): AttackOutcome {
  const accuracy = computeAccuracy(attacker, defender, attackType, comboStep);
  const hit = rollHit(accuracy, rng);
  if (!hit) return { hit: false, crit: false, damage: 0, accuracy };
  const crit = rollCrit(attacker, rng);
  const damage = computeDamage(attacker, defender, attackType, crit, rng);
  return { hit: true, crit, damage, accuracy };
}

/**
 * A configurable attack pattern (task 3.4): a repeating sequence of attack types.
 * The pattern cycle and the 3-step combo cycle advance independently — combo step
 * is `attackIndex % 3` (resets after the third attack) regardless of pattern length.
 */
export class AttackPattern {
  constructor(private readonly sequence: AttackType[]) {
    if (sequence.length === 0) throw new Error("attack pattern cannot be empty");
  }
  typeAt(attackIndex: number): AttackType {
    return this.sequence[attackIndex % this.sequence.length];
  }
  comboStepAt(attackIndex: number): number {
    return attackIndex % COMBO_LENGTH;
  }
}
