/**
 * Per-weapon-kind attack profiles (weapon-attack-profiles spec).
 *
 * Two orthogonal axes: hits per combo step (multi-hit weapons swing/fire more
 * than once per step) and max targets per swing (sweeps and spreads strike
 * several enemies). The authentic structure — one strike list per combo step,
 * repeated per mechgun bullet pair / dagger swing — is client-side in PSO and
 * absent from newserv, so hit counts follow the client's known behavior and
 * max-target counts are our balance constants (the client uses spatial arcs,
 * not fixed numbers).
 */

import { WEAPON_KIND_NAMES, type WeaponKindName } from "../items";
import { COMBO_LENGTH } from "../combat";

export interface AttackProfile {
  /** Hits performed at each of the three combo steps. */
  hitsPerStep: [number, number, number];
  /** Living enemies struck per swing, in roster order. */
  maxTargets: number;
}

export const DEFAULT_ATTACK_PROFILE: AttackProfile = {
  hitsPerStep: [1, 1, 1],
  maxTargets: 1,
};

/** Authored profiles; kinds not listed use {@link DEFAULT_ATTACK_PROFILE}. */
export const ATTACK_PROFILES: Partial<Record<WeaponKindName, AttackProfile>> = {
  // multi-hit, single target
  dagger: { hitsPerStep: [2, 2, 2], maxTargets: 1 },
  "double-saber": { hitsPerStep: [2, 1, 3], maxTargets: 1 },
  mechgun: { hitsPerStep: [3, 3, 3], maxTargets: 1 },
  "twin-sword": { hitsPerStep: [1, 2, 2], maxTargets: 1 },
  card: { hitsPerStep: [1, 1, 3], maxTargets: 1 },
  // multi-target sweeps/spreads, one hit per target
  sword: { hitsPerStep: [1, 1, 1], maxTargets: 4 },
  partisan: { hitsPerStep: [1, 1, 1], maxTargets: 3 },
  slicer: { hitsPerStep: [1, 1, 1], maxTargets: 4 },
  shot: { hitsPerStep: [1, 1, 1], maxTargets: 5 },
};

for (const [kind, profile] of Object.entries(ATTACK_PROFILES)) {
  if (profile.hitsPerStep.length !== COMBO_LENGTH) {
    throw new Error(`attack profile for ${kind} must cover ${COMBO_LENGTH} combo steps`);
  }
}

/**
 * Profile for an authentic animation category (0..18); `null` means
 * barehanded (fists — default profile).
 */
export function attackProfileForWeaponKind(weaponKind: number | null): AttackProfile {
  if (weaponKind === null) return DEFAULT_ATTACK_PROFILE;
  const name = WEAPON_KIND_NAMES[weaponKind];
  if (name === undefined) throw new Error(`unknown WeaponKind ${weaponKind}`);
  return ATTACK_PROFILES[name] ?? DEFAULT_ATTACK_PROFILE;
}
