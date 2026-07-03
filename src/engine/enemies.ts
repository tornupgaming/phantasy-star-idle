/**
 * Enemy data model (task 4.1; authentic stats: enemy-stat-data spec).
 *
 * An `EnemyDef` references an enemy type in the generated stat dataset
 * (src/engine/data/enemy-stats.json — authentic PSO BB Solo values) plus the
 * hand-authored "feel" fields that battle-params doesn't carry (pacing class,
 * damage spread/variance). Difficulty selects the dataset row directly — there
 * is no stat scaling. Enemies attack the character through
 * the same combat pipeline in reverse, so an enemy also projects into a
 * `Combatant` (critDivisor = 2).
 */

import type { Combatant } from "./combat";
import type { EnemyType } from "./pacing";
import {
  enemyDisplayName,
  getEnemyStats,
  type EnemyStatRow,
  type Episode,
  type StatRowDifficulty,
} from "./data/enemy-stats";

export interface EnemyDef {
  id: string; // definition id (roster/content key)
  /** Key into the stat dataset (newserv EnemyType name, e.g. "BOOMA"). */
  statsType: string;
  episode: Episode;
  enemyType: EnemyType; // drives attack speed (pacing table)
  spread: number; // damage spread (WSpread analogue)
  pvarMax: number; // enemy damage variance range
}

/** A live enemy in a run: the dataset row for the run's difficulty + current HP. */
export interface EnemyInstance {
  def: EnemyDef;
  /** Display name, honoring Ultimate-mode renames (Booma → Bartle, ...). */
  name: string;
  /** The authentic stat row (also carries exp/meseta kill awards). */
  stats: EnemyStatRow;
  maxHp: number;
  hp: number;
  combatant: Combatant;
}

export function instantiateEnemy(def: EnemyDef, difficulty: StatRowDifficulty): EnemyInstance {
  const stats = getEnemyStats(def.statsType, def.episode, difficulty);
  const name = enemyDisplayName(def.statsType, difficulty);
  const combatant: Combatant = {
    name,
    atp: stats.atp,
    dfp: stats.dfp,
    ata: stats.ata,
    evp: stats.evp,
    lck: stats.lck,
    eqAtp: 0, // enemies have no equipment
    spread: def.spread,
    pvarMax: def.pvarMax,
    critDivisor: 2, // enemy crit rate = LCK/2 %
  };
  return { def, name, stats, maxHp: stats.hp, hp: stats.hp, combatant };
}

export function isDead(enemy: EnemyInstance): boolean {
  return enemy.hp <= 0;
}
