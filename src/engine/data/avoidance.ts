/**
 * Per-weapon-kind avoidance table (weapon-avoidance spec; design D1).
 *
 * Models the movement layer the idle sim lacks: in authentic PSO a player
 * avoids most incoming attacks by positioning, and longer-range weapons make
 * keeping distance easier. Each incoming enemy attack is sidestepped with the
 * equipped weapon kind's percentage before the authentic ATA/EVP pipeline runs
 * (the pre-roll lives in run.ts; the combat formulas are untouched).
 *
 * Tier ordering and spacing are the authored contract (grounded in each kind's
 * authentic effective range — mechguns and shots are close-range guns despite
 * the names); absolute values are the balance-tuning knob (design D5). Enemy
 * pressure will subtract inside the same roll when it lands (design D6).
 */

import { WEAPON_KIND_NAMES, type WeaponKindName } from "../items";

export const AVOIDANCE_PCT: Record<WeaponKindName, number> = {
  // melee, point-blank
  fist: 20,
  saber: 20,
  dagger: 20,
  claw: 20,
  sword: 20,
  "double-saber": 20,
  "twin-sword": 20,
  katana: 20,
  // melee with reach
  partisan: 25,
  // force melee (swing like melee; techniques are out of scope)
  cane: 20,
  rod: 20,
  wand: 20,
  // close-range guns
  mechgun: 35,
  shot: 35,
  // thrown / mid
  slicer: 45,
  card: 45,
  // mid-range gun and artillery
  handgun: 50,
  launcher: 50,
  // long-range gun
  rifle: 55,
};

/**
 * Avoidance percentage for a numeric WeaponKind; `null` (barehanded) uses the
 * fist row, the same convention as pacing's FIST_KIND.
 */
export function weaponAvoidancePct(weaponKind: number | null): number {
  if (weaponKind === null) return AVOIDANCE_PCT.fist;
  const kindName = WEAPON_KIND_NAMES[weaponKind];
  if (kindName === undefined) throw new Error(`unknown WeaponKind ${weaponKind}`);
  return AVOIDANCE_PCT[kindName];
}
