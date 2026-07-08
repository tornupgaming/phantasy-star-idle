/**
 * Stage generator — rolls an authentic spawn layout for a run.
 *
 * Picks one of the area's floor's vanilla free-play configurations
 * (src/engine/data/map-spawns.json) with the run's seeded RNG, then converts
 * its spawn waves into the run engine's ordered room list. Solo dispatch uses
 * the offline (one-player) layouts, matching the Solo battle-param tables the
 * stat dataset is built from. Every draw comes from the run RNG, so the same
 * (runId, seed) always regenerates the identical stage (replay determinism).
 *
 * Each spawn wave becomes a room; waves larger than MAX_ROOM_ENEMIES are
 * split, approximating PSO's staggered spawning (a Monest streams Mothmants
 * in batches — an idle character shouldn't tank 30 at once). Box counts are a
 * simple deterministic pattern until box layouts (o.dat) are extracted.
 */

import type { AreaDef, RoomDef } from "./areas";
import type { Rng } from "./rng";
import { getFloorSpawns, rareTypeFor } from "./data/map-spawns";
import { layoutKeyForFile } from "./data/room-geometry";
import { enemyDefForStatsType } from "./content";

/** Cap on simultaneous enemies per generated room (idle combat is all-at-once). */
export const MAX_ROOM_ENEMIES = 6;

/** Per-spawn rare-variant chance (vanilla BB server default: 1/512). */
export const RARE_ENEMY_RATE = 1 / 512;

/**
 * Stat-less gadget/part spawn types dropped during generation (area-catalog
 * spec): Dubwitch revivers, Ruins bee emitters and the Dark Gunner control
 * unit, and the multi-part boss anatomy (De Rol Le segments/mines, Vol Opt
 * gadget phases, Darvant waves) — boss arenas fight the single boss enemy.
 * Types not listed here still fail loudly when unrostered.
 */
export const SKIPPED_SPAWN_TYPES: ReadonlySet<string> = new Set([
  "DUBWITCH",
  "BEE_L",
  "BEE_R",
  "DARK_GUNNER_CONTROL",
  "DARVANT",
  "DE_ROL_LE_BODY",
  "DE_ROL_LE_MINE",
  "VOL_OPT_1",
  "VOL_OPT_AMP",
  "VOL_OPT_CORE",
  "VOL_OPT_MONITOR",
  "VOL_OPT_PILLAR",
  "PIG_RAY",
]);

/** A room gets one box every BOX_EVERY rooms; the final room gets a 2-box cache. */
const BOX_EVERY = 3;
const FINAL_ROOM_BOXES = 2;

export interface Stage {
  rooms: RoomDef[];
  /** Source layout files, one per floor rolled (provenance/debugging). */
  files: string[];
  /**
   * Room-geometry layout key of the main floor's rolled variation (the
   * pre-authored map the run plays on), for the minimap. Absent when the
   * floor has no extracted geometry (boss arenas). Derived — no RNG draw.
   */
  layoutKey?: string;
}

export function generateStage(area: AreaDef, rng: Rng): Stage {
  const rooms: RoomDef[] = [];
  const files: string[] = [];
  let stageLayoutKey: string | undefined;

  const floors = area.bossFloor === undefined ? [area.floor] : [area.floor, area.bossFloor];
  for (const floorNumber of floors) {
    const floor = getFloorSpawns(area.episode, floorNumber);
    const variation = rng.pick(floor.offline);
    files.push(variation.file);
    // Minimap provenance (room-geometry-data spec): which pre-authored map
    // this variation plays on. Pure lookup — consumes no RNG.
    const floorLayoutKey = layoutKeyForFile(area.episode, floorNumber, variation.file) ?? undefined;
    if (floorNumber === area.floor) stageLayoutKey = floorLayoutKey;

    for (const wave of variation.waves) {
      const ids: string[] = [];
      const broods: RoomDef["broods"] = [];
      const monestDef = enemyDefForStatsType("MONEST");
      const mothmantDef = enemyDefForStatsType("MOTHMANT");
      const monestCount = wave.enemies.MONEST ?? 0;
      const mothmantCount = wave.enemies.MOTHMANT ?? 0;
      const mothmantsAreBrood = monestCount > 0 && mothmantCount > 0 && monestDef && mothmantDef;
      if (mothmantsAreBrood) {
        broods.push({
          sourceEnemyId: monestDef.id,
          childEnemyId: mothmantDef.id,
          total: mothmantCount,
        });
      }

      for (const [statsType, count] of Object.entries(wave.enemies)) {
        if (mothmantsAreBrood && statsType === "MOTHMANT") continue;
        if (SKIPPED_SPAWN_TYPES.has(statsType)) continue;
        const def = enemyDefForStatsType(statsType);
        if (!def) {
          throw new Error(
            `no enemy definition for spawn type ${statsType} (${area.id}, ${variation.file})`,
          );
        }
        const rareStatsType = rareTypeFor(statsType, floor.area);
        const rareDef = rareStatsType ? enemyDefForStatsType(rareStatsType) : null;
        for (let i = 0; i < count; i++) {
          const isRare = rareDef !== null && rng.chance(RARE_ENEMY_RATE);
          ids.push(isRare ? rareDef.id : def.id);
        }
      }
      for (let i = 0; i < ids.length; i += MAX_ROOM_ENEMIES) {
        const enemies = ids.slice(i, i + MAX_ROOM_ENEMIES);
        const roomBroods = broods?.filter((b) => enemies.includes(b.sourceEnemyId));
        rooms.push({
          enemies,
          broods: roomBroods?.length ? roomBroods : undefined,
          boxes: 0,
          // Split rooms share their source wave's authentic room id.
          authRoom: floorLayoutKey !== undefined ? wave.room : undefined,
        });
      }
    }
  }

  for (let i = 0; i < rooms.length; i++) {
    rooms[i].boxes = i % BOX_EVERY === BOX_EVERY - 1 ? 1 : 0;
  }
  rooms[rooms.length - 1].boxes = FINAL_ROOM_BOXES;

  return { rooms, files, ...(stageLayoutKey !== undefined ? { layoutKey: stageLayoutKey } : {}) };
}

/**
 * Every enemy definition id the area can spawn, across all of its floors'
 * offline (solo-dispatch) variations including rollable rare variants.
 * Content-coverage helper for tests; throws on a spawn type with no roster
 * definition.
 */
export function areaRoster(area: AreaDef): string[] {
  const ids = new Set<string>();
  const floors = area.bossFloor === undefined ? [area.floor] : [area.floor, area.bossFloor];
  for (const floorNumber of floors) {
    const floor = getFloorSpawns(area.episode, floorNumber);
    for (const variation of floor.offline) {
      for (const wave of variation.waves) {
        for (const statsType of Object.keys(wave.enemies)) {
          if (SKIPPED_SPAWN_TYPES.has(statsType)) continue;
          const def = enemyDefForStatsType(statsType);
          if (!def) {
            throw new Error(
              `no enemy definition for spawn type ${statsType} (${area.id}, ${variation.file})`,
            );
          }
          ids.add(def.id);
          const rareStatsType = rareTypeFor(statsType, floor.area);
          const rareDef = rareStatsType ? enemyDefForStatsType(rareStatsType) : null;
          if (rareDef) ids.add(rareDef.id);
        }
      }
    }
  }
  return [...ids].sort();
}
