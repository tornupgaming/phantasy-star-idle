/**
 * Class-derived stats, XP/leveling, and section IDs (character-progression /
 * character-roster specs).
 *
 * Base stats are never stored on a character — they are derived from
 * (classId, level) against the ported Blue Burst level table in classes.ts, so
 * the same class and level always produce the same stats. ATA follows the BB
 * convention: base is in display units, growth accumulates in tenths, and the
 * cap applies to the tenths total (see classes.ts header). LCK never grows.
 */

import type { Stats } from "./stats";
import { makeStats } from "./stats";
import type { ClassDef, SectionId } from "./classes";
import { CLASS_BY_ID, LEVEL_CAP, SECTION_IDS } from "./classes";

export function classById(classId: string): ClassDef {
  const def = CLASS_BY_ID[classId];
  if (!def) throw new Error(`unknown class: ${classId}`);
  return def;
}

/** Derived base stats for a class at a level (1..LEVEL_CAP), clamped to class caps. */
export function statsAtLevel(classId: string, level: number): Stats {
  const def = classById(classId);
  const lv = Math.max(1, Math.min(LEVEL_CAP, Math.floor(level)));
  const d = def.deltas;
  let atp = def.base.atp;
  let dfp = def.base.dfp;
  let evp = def.base.evp;
  let mst = def.base.mst;
  let hp = def.base.hp;
  let ataTenths = def.base.ata * 10;
  for (let i = 0; i < lv - 1; i++) {
    atp += d.atp[i];
    dfp += d.dfp[i];
    evp += d.evp[i];
    mst += d.mst[i];
    hp += d.hp[i];
    ataTenths += d.ataTenths[i];
  }
  return makeStats({
    atp: Math.min(atp, def.max.atp),
    dfp: Math.min(dfp, def.max.dfp),
    ata: Math.floor(Math.min(ataTenths, def.max.ataTenths) / 10),
    evp: Math.min(evp, def.max.evp),
    lck: def.base.lck, // luck never grows from leveling (authentic BB)
    mst: Math.min(mst, def.max.mst),
    hp: Math.min(hp, def.max.hp),
  });
}

/** Cumulative XP required to be the given level (level 1 → 0). */
export function xpForLevel(classId: string, level: number): number {
  const def = classById(classId);
  const lv = Math.max(1, Math.min(LEVEL_CAP, Math.floor(level)));
  return def.xpThresholds[lv - 1];
}

/** The level a total-XP amount corresponds to, capped at LEVEL_CAP. */
export function levelForXp(classId: string, xp: number): number {
  const thresholds = classById(classId).xpThresholds;
  // Binary search for the highest level whose threshold is <= xp.
  let lo = 0;
  let hi = thresholds.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (thresholds[mid] <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/**
 * Section ID derived from a character name: sum of UTF-16 code units mod 10
 * (the classic PSO algorithm). Used as the creation-time default; the player
 * may override it.
 */
export function sectionIdFromName(name: string): SectionId {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return SECTION_IDS[sum % SECTION_IDS.length];
}
