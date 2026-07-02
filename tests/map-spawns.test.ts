/**
 * The generated map spawn dataset carries authentic BB free-play layouts and
 * the extraction pipeline is deterministic (byte-identical regeneration).
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import enemyStats from "../src/engine/data/enemy-stats.json";
import {
  getFloorSpawns,
  getFloorSpawnsByName,
  listFloors,
  rareTypeFor,
} from "../src/engine/data/map-spawns";

const NEWSERV_ROOT = process.env.NEWSERV_ROOT ?? "/home/psmith/projects/newserv";
const DATASET_PATH = join(__dirname, "..", "src", "engine", "data", "map-spawns.json");

// Control/structural entities and boss body parts without stat rows (their
// stats live with the canonical boss entry). Mirrors the extractor allowlist.
const STATLESS_TYPES = new Set([
  "DUBWITCH",
  "DARK_GUNNER_CONTROL",
  "BEE_L",
  "BEE_R",
  "DARVANT",
  "DE_ROL_LE_BODY",
  "DE_ROL_LE_MINE",
  "PIG_RAY",
  "VOL_OPT_1",
  "VOL_OPT_AMP",
  "VOL_OPT_CORE",
  "VOL_OPT_MONITOR",
  "VOL_OPT_PILLAR",
]);

describe("map spawn dataset", () => {
  it("carries the vanilla Forest 1 configurations", () => {
    const forest1 = getFloorSpawnsByName("1", "Forest 1");
    expect(forest1.floor).toBe(1);
    expect(forest1.area).toBe(1);
    expect(forest1.online).toHaveLength(5);
    expect(forest1.offline).toHaveLength(3);
    expect(forest1.online[0].file).toBe("map_forest01_00e.dat");
    expect(forest1.offline[0].file).toBe("map_forest01_00_offe.dat");

    const types = new Set(forest1.online[0].waves.flatMap((w) => Object.keys(w.enemies)));
    for (const expected of ["BOOMA", "RAG_RAPPY", "MONEST", "MOTHMANT", "SAVAGE_WOLF"]) {
      expect(types, expected).toContain(expected);
    }
    // A Monest spawn always brings its Mothmant brood.
    const mothmants = forest1.online[0].waves.reduce(
      (n, w) => n + (w.enemies.MOTHMANT ?? 0),
      0,
    );
    expect(mothmants).toBe(60); // 2 Monests x 30
  });

  it("carries boss floors", () => {
    const dragon = getFloorSpawns("1", 11);
    expect(dragon.boss).toBe(true);
    expect(dragon.online[0].waves.some((w) => w.enemies.DRAGON)).toBe(true);
  });

  it("maps rare variants per area", () => {
    expect(rareTypeFor("RAG_RAPPY", 0x01)).toBe("AL_RAPPY"); // Ep1 Forest
    expect(rareTypeFor("RAG_RAPPY", 0x17)).toBe("LOVE_RAPPY"); // Ep2 CCA
    expect(rareTypeFor("HILDEBEAR", 0x01)).toBe("HILDEBLUE");
    expect(rareTypeFor("BOOMA", 0x01)).toBeNull();
  });

  it("every floor has at least one variation per mode", () => {
    for (const episode of ["1", "2", "4"] as const) {
      for (const floor of listFloors(episode)) {
        expect(floor.online.length, `${floor.name} online`).toBeGreaterThan(0);
        expect(floor.offline.length, `${floor.name} offline`).toBeGreaterThan(0);
      }
    }
  });

  it("every spawned type resolves against enemy-stats.json (or is a known statless part)", () => {
    const stats = enemyStats as Record<string, unknown>;
    for (const episode of ["1", "2", "4"] as const) {
      for (const floor of listFloors(episode)) {
        for (const mode of ["online", "offline"] as const) {
          for (const variation of floor[mode]) {
            for (const wave of variation.waves) {
              for (const type of Object.keys(wave.enemies)) {
                const known = stats[type] !== undefined || STATLESS_TYPES.has(type);
                expect(known, `${floor.name} ${variation.file}: ${type}`).toBe(true);
                const rareType = rareTypeFor(type, floor.area);
                if (rareType) {
                  expect(stats[rareType], `rare ${rareType}`).toBeDefined();
                }
              }
            }
          }
        }
      }
    }
  });

  // Regeneration requires the local newserv clone; skip where it isn't present.
  it.skipIf(!existsSync(NEWSERV_ROOT))("regenerates byte-identically from newserv", () => {
    const before = readFileSync(DATASET_PATH);
    execFileSync("node", [join(__dirname, "..", "scripts", "extract-map-spawns.mjs")], {
      env: { ...process.env, NEWSERV_ROOT },
    });
    const after = readFileSync(DATASET_PATH);
    expect(after.equals(before)).toBe(true);
  });
});
