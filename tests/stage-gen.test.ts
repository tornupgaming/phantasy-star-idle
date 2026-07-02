import { describe, expect, it } from "vitest";
import { getArea } from "../src/engine/content";
import { generateStage } from "../src/engine/stage-gen";
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
});
