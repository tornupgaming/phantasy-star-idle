/**
 * Attack-speed / pacing layer — the primary pacing knob (design D5;
 * combo-burst rhythm from battle-scene-view D5).
 *
 * The character attacks in PSO-style three-hit bursts timed by authentic frame
 * data (attack-frame-data spec): each swing bills its rig × weapon-kind ×
 * attack-tier duration — the Combo flavor while the burst continues, the Full
 * flavor (which includes the animation's recovery tail) when the burst ends.
 * Finishing a burst — or killing the target — additionally costs the
 * repositioning pause, the movement time the frame data doesn't model and this
 * idle game's hand-tuned pacing valve. Enemies keep a flat interval per enemy
 * type. All values are **game milliseconds**; lower = faster.
 */

import { COMBO_LENGTH, type AttackType } from "./combat";
import type { Rig } from "./classes";
import { attackStepMs } from "./data/frame-data";

export type EnemyType = "grunt" | "beast" | "flyer" | "boss";

/** Barehanded attacks use the fist animations (WeaponKind 0). */
export const FIST_KIND = 0;

/**
 * Fixed pause after a finished burst (or a kill) — PSO's movement/repositioning
 * time between targets. Animation recovery already lives in the frame data's
 * Full durations, so this is movement only (smaller than the old 1000ms which
 * covered both).
 */
export const COMBO_RECOVERY_MS = 400;

/**
 * ms between enemy attacks, by enemy type. Scaled ×~1.45 when frame-data
 * character timing landed (authentic swings are slower than the old archetype
 * table) to preserve the pre-existing exchange ratio of ~2.4 character swings
 * per grunt attack.
 */
export const ENEMY_ATTACK_INTERVAL_MS: Record<EnemyType, number> = {
  grunt: 2200,
  beast: 1600,
  flyer: 1900,
  boss: 1450,
};

/**
 * Delay from a just-performed character swing to the next one. `comboReset` is
 * true when the swing killed its target (the combo restarts against a new
 * enemy); the swing then bills its Full duration (the animation completes) and
 * the repositioning pause applies, as it does after the final step of a burst.
 */
export function nextComboDelay(
  rig: Rig,
  weaponKind: number | null,
  attackType: AttackType,
  stepJustPerformed: number,
  comboReset: boolean,
  speedBoost: number,
): number {
  const burstOver = comboReset || stepJustPerformed >= COMBO_LENGTH - 1;
  const step = attackStepMs(
    rig,
    weaponKind ?? FIST_KIND,
    attackType,
    stepJustPerformed,
    burstOver,
    speedBoost,
  );
  return burstOver ? step + COMBO_RECOVERY_MS : step;
}

/**
 * Delay from engaging (run start, new room) to the character's first swing:
 * the repositioning pause plus the first step's chained duration.
 */
export function engageDelayMs(
  rig: Rig,
  weaponKind: number | null,
  attackType: AttackType,
  speedBoost: number,
): number {
  return COMBO_RECOVERY_MS + attackStepMs(rig, weaponKind ?? FIST_KIND, attackType, 0, false, speedBoost);
}

export function enemyInterval(enemyType: EnemyType): number {
  return ENEMY_ATTACK_INTERVAL_MS[enemyType];
}
