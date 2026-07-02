import { describe, it, expect } from "vitest";
import { CLASSES, CLASS_BY_ID, LEVEL_CAP, SECTION_IDS } from "../src/engine/classes";
import {
  statsAtLevel,
  levelForXp,
  xpForLevel,
  sectionIdFromName,
} from "../src/engine/progression";

describe("ported BB class table (classes.ts)", () => {
  it("has the 12 BB classes and 10 section IDs in canonical order", () => {
    expect(CLASSES.map((c) => c.name)).toEqual([
      "HUmar", "HUnewearl", "HUcast", "RAmar", "RAcast", "RAcaseal",
      "FOmarl", "FOnewm", "FOnewearl", "HUcaseal", "FOmar", "RAmarl",
    ]);
    expect(SECTION_IDS).toEqual([
      "Viridia", "Greenill", "Skyly", "Bluefull", "Purplenum",
      "Pinkal", "Redria", "Oran", "Yellowboze", "Whitill",
    ]);
  });

  it("pins HUmar level 1 stats to the BB table base values", () => {
    expect(statsAtLevel("humar", 1)).toEqual({
      atp: 35, dfp: 17, ata: 30, evp: 45, lck: 10, mst: 29, hp: 20,
    });
  });

  it("pins FOnewearl level 1 stats to the BB table base values", () => {
    expect(statsAtLevel("fonewearl", 1)).toEqual({
      atp: 10, dfp: 13, ata: 10, evp: 53, lck: 10, mst: 58, hp: 19,
    });
  });

  it("pins HUmar level 200 stats (ATA clamped by the tenths cap to 135)", () => {
    expect(statsAtLevel("humar", 200)).toEqual({
      atp: 933, dfp: 422, ata: 135, evp: 682, lck: 10, mst: 594, hp: 511,
    });
  });

  it("pins RAcast level 200 stats (highest-ATA ranger curve)", () => {
    expect(statsAtLevel("racast", 200)).toEqual({
      atp: 854, dfp: 505, ata: 153, evp: 626, lck: 10, mst: 0, hp: 863,
    });
  });

  it("luck never grows from leveling (authentic BB quirk)", () => {
    for (const c of CLASSES) {
      expect(statsAtLevel(c.id, 200).lck).toBe(c.base.lck);
    }
  });

  it("XP thresholds are strictly monotonic for all 12 classes", () => {
    for (const c of CLASSES) {
      expect(c.xpThresholds).toHaveLength(LEVEL_CAP);
      expect(c.xpThresholds[0]).toBe(0);
      for (let i = 1; i < c.xpThresholds.length; i++) {
        expect(c.xpThresholds[i]).toBeGreaterThan(c.xpThresholds[i - 1]);
      }
      expect(c.deltas.atp).toHaveLength(LEVEL_CAP - 1);
    }
  });

  it("stats never exceed class caps at any level", () => {
    for (const c of CLASSES) {
      for (const lv of [50, 100, 150, 200]) {
        const s = statsAtLevel(c.id, lv);
        expect(s.atp).toBeLessThanOrEqual(c.max.atp);
        expect(s.dfp).toBeLessThanOrEqual(c.max.dfp);
        expect(s.ata * 10).toBeLessThanOrEqual(c.max.ataTenths);
        expect(s.evp).toBeLessThanOrEqual(c.max.evp);
        expect(s.mst).toBeLessThanOrEqual(c.max.mst);
        expect(s.hp).toBeLessThanOrEqual(c.max.hp);
      }
    }
  });
});

describe("XP → level (progression.ts)", () => {
  it("pins the early BB thresholds: level 2 at 50 XP, level 3 at 200 XP", () => {
    expect(xpForLevel("humar", 1)).toBe(0);
    expect(xpForLevel("humar", 2)).toBe(50);
    expect(xpForLevel("humar", 3)).toBe(200);
    expect(xpForLevel("humar", 200)).toBe(83_227_800);
  });

  it("levelForXp respects threshold boundaries", () => {
    expect(levelForXp("humar", 0)).toBe(1);
    expect(levelForXp("humar", 49)).toBe(1);
    expect(levelForXp("humar", 50)).toBe(2);
    expect(levelForXp("humar", 199)).toBe(2);
    expect(levelForXp("humar", 200)).toBe(3);
  });

  it("caps at level 200 regardless of XP", () => {
    expect(levelForXp("humar", 10_000_000_000)).toBe(200);
  });

  it("rejects unknown class ids", () => {
    expect(() => statsAtLevel("nope", 1)).toThrow(/unknown class/);
    expect(CLASS_BY_ID["humar"].name).toBe("HUmar");
  });
});

describe("section ID from name", () => {
  it("derives sum of char codes mod 10", () => {
    // "A" = 65 → 65 % 10 = 5 → Pinkal
    expect(sectionIdFromName("A")).toBe("Pinkal");
    // "AB" = 65+66=131 → 1 → Greenill
    expect(sectionIdFromName("AB")).toBe("Greenill");
    expect(sectionIdFromName("")).toBe("Viridia");
  });

  it("is stable for a given name", () => {
    expect(sectionIdFromName("Hunter")).toBe(sectionIdFromName("Hunter"));
  });
});
