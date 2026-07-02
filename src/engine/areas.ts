/**
 * Area / room model + difficulty scheme (tasks 4.2, 4.3).
 *
 * An area references a PSO floor; its room list is generated per run by the
 * stage generator (stage-gen.ts) from one of the floor's authentic free-play
 * spawn layouts (src/engine/data/map-spawns.json), picked with the run's
 * seeded RNG. Each generated room lists enemy definition-ids and a number of
 * item boxes (with a box drop table). The run clears rooms in order
 * (run-simulation spec). Difficulty selects the enemies' authentic stat rows
 * (enemy-stat-data spec) and a drop tier; XP and base meseta come from those rows.
 */

import type { Episode } from "./data/enemy-stats";

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

export interface AreaDef {
  id: string;
  name: string;
  /** Suggested character power level, shown in the prep view. */
  recommendedAtp: number;
  /** Episode + floor whose authentic spawn layouts this area rolls. */
  episode: Episode;
  floor: number;
  /** Optional boss floor appended after the main floor (e.g. the Dragon). */
  bossFloor?: number;
  /** Drop table id for this area's item boxes. */
  boxDropTableId: string;
}

export type DifficultyId = "normal" | "hard" | "ultimate";

export interface DifficultyDef {
  id: DifficultyId;
  label: string;
  /** Which drop tier to select from a drop table (0 = base). */
  dropTier: number;
  /** Multiplier applied to meseta drops (economy knob; enemy base comes from the stat row). */
  mesetaMult: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  normal: {
    id: "normal",
    label: "Normal",
    dropTier: 0,
    mesetaMult: 1,
  },
  hard: {
    id: "hard",
    label: "Hard",
    dropTier: 1,
    mesetaMult: 2,
  },
  ultimate: {
    id: "ultimate",
    label: "Ultimate",
    dropTier: 2,
    mesetaMult: 4,
  },
};

export function difficulty(id: DifficultyId): DifficultyDef {
  return DIFFICULTIES[id];
}

export function totalEnemies(rooms: RoomDef[]): number {
  return rooms.reduce((n, r) => n + r.enemies.length, 0);
}
