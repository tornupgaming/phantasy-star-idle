/**
 * Character stat model (task 2.1).
 *
 * The seven stats the combat formulas need. "Effective" stats are base stats plus
 * every equipped item's contribution; base stats are the character's own and are
 * never mutated by a run (character-equipment spec: "Base stats persist across runs").
 */

export interface Stats {
  atp: number; // Attack Power
  dfp: number; // Defense Power
  ata: number; // Accuracy
  evp: number; // Evasion
  lck: number; // Luck (feeds crit rate)
  mst: number; // Mind/technique stat (reserved; techniques deferred)
  hp: number; // Max HP
  tp: number; // Max TP (derived from MST/level/role; technique casting deferred)
}

export const ZERO_STATS: Stats = { atp: 0, dfp: 0, ata: 0, evp: 0, lck: 0, mst: 0, hp: 0, tp: 0 };

export function makeStats(partial: Partial<Stats>): Stats {
  return { ...ZERO_STATS, ...partial };
}

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  return {
    atp: a.atp + (b.atp ?? 0),
    dfp: a.dfp + (b.dfp ?? 0),
    ata: a.ata + (b.ata ?? 0),
    evp: a.evp + (b.evp ?? 0),
    lck: a.lck + (b.lck ?? 0),
    mst: a.mst + (b.mst ?? 0),
    hp: a.hp + (b.hp ?? 0),
    tp: a.tp + (b.tp ?? 0),
  };
}

export function sumStats(parts: Array<Partial<Stats>>): Stats {
  return parts.reduce<Stats>((acc, p) => addStats(acc, p), { ...ZERO_STATS });
}
