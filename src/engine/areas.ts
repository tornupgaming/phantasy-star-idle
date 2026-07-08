/**
 * Area / room model + difficulty scheme (tasks 4.2, 4.3).
 *
 * An area references a PSO floor; its room list is generated per run by the
 * stage generator (stage-gen.ts) from one of the floor's authentic free-play
 * spawn layouts (src/engine/data/map-spawns.json), picked with the run's
 * seeded RNG. Each generated room lists enemy definition-ids and a number of
 * item boxes (with a box drop table). The run clears rooms in order
 * (run-simulation spec). Difficulty selects the enemies' authentic stat rows
 * (enemy-stat-data spec). XP comes from those rows; meseta comes only from drops.
 */

import type { Episode } from "./data/enemy-stats";
import type { DropDifficulty } from "./drop-gen";

export interface RoomBroodDef {
  /** Enemy definition id that owns the brood spawner. */
  sourceEnemyId: string;
  /** Enemy definition id appended while the source remains alive. */
  childEnemyId: string;
  /** Total children from the authentic spawn wave assigned to this brood. */
  total: number;
}

export interface RoomDef {
  /** Enemy definition ids present in the room at entry, fought in listed order. */
  enemies: string[];
  /** Dynamic child spawners attached to enemies in this room. */
  broods?: RoomBroodDef[];
  /** Number of item boxes in the room. */
  boxes: number;
}

/** Destination-list group; boss arenas join their authentic zone. */
export type ZoneId = "Forest" | "Caves" | "Mines" | "Ruins";

export interface AreaDef {
  id: string;
  name: string;
  /** Zone group heading in the destination list. */
  zone: ZoneId;
  /** Suggested character power level, shown in the prep view. */
  recommendedAtp: number;
  /** Episode + floor whose authentic spawn layouts this area rolls. */
  episode: Episode;
  floor: number;
  /**
   * Optional boss floor appended after the main floor. Legacy-only: kept for
   * the hidden `mines` compatibility def (Mine 1 + Dragon) so persisted runs
   * replay identically; catalog boss arenas are standalone areas instead.
   */
  bossFloor?: number;
  /** Boss arena: the floor's layout yields a single boss enemy. */
  boss?: true;
}

export type DifficultyId = "normal" | "hard" | "vhard" | "ultimate";

/** Explicit common-drop table area_norm mapping (Forest 1 = 0). */
export const AREA_NORM_BY_FLOOR: Record<number, number> = {
  1: 0, // Forest 1
  2: 1, // Forest 2
  3: 2, // Cave 1
  4: 3, // Cave 2
  5: 4, // Cave 3
  6: 5, // Mine 1
  7: 6, // Mine 2
  8: 7, // Ruins 1
  9: 8, // Ruins 2
  10: 9, // Ruins 3 / final boss rule
  11: 2, // Dragon boss floor → Cave 1
  12: 5, // De Rol Le boss floor → Mine 1
  13: 7, // Vol Opt boss floor → Ruins 1
  14: 9, // Dark Falz (final boss) → Ruins 3
};

export function areaNormForFloor(floor: number): number {
  const areaNorm = AREA_NORM_BY_FLOOR[floor];
  if (areaNorm === undefined) throw new Error(`no area_norm mapping for floor ${floor}`);
  return areaNorm;
}

export interface DifficultyDef {
  id: DifficultyId;
  label: string;
  /** Key into the extracted drop-table datasets (extractor emits "VeryHard" without a space). */
  dropKey: DropDifficulty;
  /**
   * Multiplier applied to dropped meseta (economy knob). The authentic tables
   * already scale meseta ranges by difficulty (~10–20× Normal → Ultimate);
   * the mult stacks on top because higher difficulties burn dimates/trimates
   * at 3–8× the monomate price — raw drops alone don't cover restock
   * (authentic-drop-generation 7.2 baseline).
   */
  mesetaMult: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  normal: {
    id: "normal",
    label: "Normal",
    dropKey: "Normal",
    mesetaMult: 1,
  },
  hard: {
    id: "hard",
    label: "Hard",
    dropKey: "Hard",
    mesetaMult: 2,
  },
  vhard: {
    id: "vhard",
    label: "Very Hard",
    dropKey: "VeryHard",
    mesetaMult: 3,
  },
  ultimate: {
    id: "ultimate",
    label: "Ultimate",
    dropKey: "Ultimate",
    mesetaMult: 4,
  },
};

export function difficulty(id: DifficultyId): DifficultyDef {
  return DIFFICULTIES[id];
}

export function totalEnemies(rooms: RoomDef[]): number {
  return rooms.reduce((n, r) => n + r.enemies.length, 0);
}
