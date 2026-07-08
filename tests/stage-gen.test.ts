import { describe, expect, it } from "vitest";
import { AREA_LIST, getArea, getEnemyDef } from "../src/engine/content";
import { SKIPPED_SPAWN_TYPES, generateStage } from "../src/engine/stage-gen";
import { createRng } from "../src/engine/rng";

function forestStage(seed = 42) {
  return generateStage(getArea("forest"), createRng("stage-gen-test", seed));
}

describe("stage generation", () => {
  it("turns Forest Monest Mothmant waves into brood metadata", () => {
    const seenFiles = new Set<string>();
    const broodRooms = [] as ReturnType<typeof forestStage>["rooms"];

    // Sample enough seeds to cover all three Forest 1 offline variations.
    for (let seed = 1; seed <= 100 && seenFiles.size < 3; seed++) {
      const stage = forestStage(seed);
      seenFiles.add(stage.files[0]);
      broodRooms.push(...stage.rooms.filter((r) => r.broods?.some((b) => b.childEnemyId === "mothmant")));
    }

    expect(seenFiles.size).toBe(3);
    expect(broodRooms.length).toBeGreaterThan(0);
    for (const room of broodRooms) {
      expect(room.enemies).toContain("monest");
      expect(room.enemies).not.toContain("mothmant");
      expect(room.broods).toEqual([
        { sourceEnemyId: "monest", childEnemyId: "mothmant", total: 30 },
      ]);
    }
  });

  it("does not create Mothmant-only rooms from Monest broods", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const stage = forestStage(seed);
      expect(stage.rooms.some((r) => r.enemies.length > 0 && r.enemies.every((id) => id === "mothmant"))).toBe(
        false,
      );
    }
  });

  it("remains deterministic for a fixed seed", () => {
    expect(forestStage(7)).toEqual(forestStage(7));
  });

  it("generates every catalog area without error, with no skip-listed types", () => {
    for (const area of AREA_LIST) {
      for (let seed = 1; seed <= 10; seed++) {
        const stage = generateStage(area, createRng("stage-gen-coverage", seed));
        expect(stage.rooms.length, area.id).toBeGreaterThan(0);
        for (const room of stage.rooms) {
          for (const id of room.enemies) {
            expect(SKIPPED_SPAWN_TYPES.has(getEnemyDef(id).statsType), `${area.id}: ${id}`).toBe(
              false,
            );
          }
        }
      }
    }
  });

  it("boss arenas generate a single room with exactly the boss enemy", () => {
    const expected: Record<string, string> = {
      dragon: "dragon",
      "de-rol-le": "de-rol-le",
      "vol-opt": "vol-opt",
      "dark-falz": "dark-falz",
    };
    for (const [areaId, bossId] of Object.entries(expected)) {
      for (let seed = 1; seed <= 5; seed++) {
        const stage = generateStage(getArea(areaId), createRng("boss-stage", seed));
        const enemies = stage.rooms.flatMap((r) => r.enemies);
        expect(enemies, areaId).toEqual([bossId]);
      }
    }
  });
});
