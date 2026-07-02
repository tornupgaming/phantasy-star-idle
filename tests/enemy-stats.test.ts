/**
 * enemy-stat-data spec: the generated dataset carries authentic BB Solo values,
 * and the extraction pipeline is deterministic (byte-identical regeneration).
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import dataset from "../src/engine/data/enemy-stats.json";
import { instantiateEnemy } from "../src/engine/enemies";
import { AREAS, ENEMIES, getEnemyDef } from "../src/engine/content";
import { areaRoster } from "../src/engine/stage-gen";

const NEWSERV_ROOT = process.env.NEWSERV_ROOT ?? "/home/psmith/projects/newserv";
const DATASET_PATH = join(__dirname, "..", "src", "engine", "data", "enemy-stats.json");

describe("enemy stat dataset", () => {
  it("carries Solo-table reference values (Ep1 Normal)", () => {
    const stats = dataset as Record<string, any>;
    expect(stats.BOOMA.perEpisode["1"].normal.hp).toBe(60);
    expect(stats.BOOMA.perEpisode["1"].normal.atp).toBe(80);
    expect(stats.DRAGON.perEpisode["1"].normal.hp).toBe(1300);
    expect(stats.DRAGON.perEpisode["1"].normal.exp).toBe(350);
  });

  it("has all four difficulty rows for every episode of every enemy", () => {
    for (const [type, entry] of Object.entries(dataset as Record<string, any>)) {
      for (const ep of entry.episodes) {
        const rows = entry.perEpisode[ep];
        expect(rows, `${type} ep${ep}`).toBeDefined();
        for (const diff of ["normal", "hard", "vhard", "ultimate"]) {
          expect(rows[diff]?.hp, `${type} ep${ep} ${diff}`).toBeTypeOf("number");
        }
      }
    }
  });

  it("carries Ultimate display names for renamed enemies", () => {
    const stats = dataset as Record<string, any>;
    expect(stats.BOOMA.ultimateName).toBe("Bartle");
    expect(stats.GILLCHIC.displayName).toBe("Gillchic");
  });

  it("difficulty selects the authentic row — no multipliers (enemy-stat-data spec)", () => {
    const normal = instantiateEnemy(ENEMIES.booma, "normal");
    const hard = instantiateEnemy(ENEMIES.booma, "hard");
    // Solo Ep1 values straight from the dataset.
    expect(normal.maxHp).toBe(60);
    expect(normal.combatant.atp).toBe(80);
    expect(hard.maxHp).toBe(386);
    expect(hard.combatant.atp).toBe(362);
    // Kill awards come from the row too.
    expect(normal.stats.exp).toBe(5);
    expect(hard.stats.exp).toBe(42);
  });

  it("renames enemies in Ultimate", () => {
    expect(instantiateEnemy(ENEMIES.booma, "normal").name).toBe("Booma");
    expect(instantiateEnemy(ENEMIES.booma, "ultimate").name).toBe("Bartle");
  });

  it("every area roster entry resolves to dataset stats on all four difficulties", () => {
    for (const area of Object.values(AREAS)) {
      for (const id of areaRoster(area)) {
        const def = getEnemyDef(id);
        for (const diff of ["normal", "hard", "vhard", "ultimate"] as const) {
          const inst = instantiateEnemy(def, diff);
          expect(inst.maxHp, `${area.id}/${id}/${diff}`).toBeGreaterThan(0);
        }
      }
    }
  });

  // Regeneration requires the local newserv clone; skip where it isn't present.
  it.skipIf(!existsSync(NEWSERV_ROOT))("regenerates byte-identically from newserv", () => {
    const before = readFileSync(DATASET_PATH);
    execFileSync("node", [join(__dirname, "..", "scripts", "extract-battle-params.mjs")], {
      env: { ...process.env, NEWSERV_ROOT },
    });
    const after = readFileSync(DATASET_PATH);
    expect(after.equals(before)).toBe(true);
  });
});
