/**
 * Enemy sprite coverage: every enemy the areas can spawn resolves to art on
 * every difficulty (including Ultimate renames), except known gaps that
 * intentionally fall back to the placeholder box.
 */

import { describe, expect, it } from "vitest";
import { enemyArtUrl } from "../src/ui/enemy-art";
import { AREAS, getEnemyDef } from "../src/engine/content";
import { instantiateEnemy } from "../src/engine/enemies";
import { areaRoster } from "../src/engine/stage-gen";

// No art has been ingested for these yet — they render as the placeholder box.
const KNOWN_MISSING = new Set(["dragon", "al-rappy", "nar-lily", "hidoom", "migium"]);

describe("enemy art", () => {
  it("covers every area roster entry on all four difficulties", () => {
    for (const area of Object.values(AREAS)) {
      for (const id of areaRoster(area)) {
        if (KNOWN_MISSING.has(id)) continue;
        const def = getEnemyDef(id);
        for (const diff of ["normal", "hard", "vhard", "ultimate"] as const) {
          const inst = instantiateEnemy(def, diff);
          expect(
            enemyArtUrl(inst.name, def.id),
            `${id} (${inst.name}, ${diff})`,
          ).toBeTruthy();
        }
      }
    }
  });

  it("falls back from an Ultimate rename without its own art to the base sprite", () => {
    // Gulgus (Ultimate Savage Wolf) has no gulgus.png; it reuses savage-wolf.png.
    const ult = instantiateEnemy(getEnemyDef("savage-wolf"), "ultimate");
    expect(ult.name).toBe("Gulgus");
    expect(enemyArtUrl(ult.name, "savage-wolf")).toContain("savage-wolf");
  });

  it("returns null when no art exists at all", () => {
    expect(enemyArtUrl("Dragon", "dragon")).toBeNull();
  });
});
