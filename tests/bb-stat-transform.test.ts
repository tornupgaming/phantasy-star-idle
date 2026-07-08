import { describe, it, expect } from "vitest";
import { CLASSES, CLASS_ATA_CONST_TENTHS } from "../src/engine/classes";
import { statsAtLevel } from "../src/engine/progression";
import fixture from "./fixtures/ephinea-class-stats.json";

/**
 * Verifies the BB client stat transform against Ephinea wiki growth tables
 * (authentic client-displayed base stats) for all 12 classes at every
 * published level. Cells listed in the fixture's knownWikiTypos (isolated
 * wiki cells contradicting 40+ formula-consistent cells) are skipped.
 */

type Cell = { classId: string; stat: string; level: number };
const typos = new Set(
  (fixture.knownWikiTypos as Cell[]).map((t) => `${t.classId}:${t.stat}:${t.level}`),
);
const isTypo = (classId: string, stat: string, level: number) =>
  typos.has(`${classId}:${stat}:${level}`);

const STAT_KEYS: Array<[wiki: string, ours: "hp" | "atp" | "dfp" | "mst" | "evp" | "tp"]> = [
  ["HP", "hp"],
  ["ATP", "atp"],
  ["DFP", "dfp"],
  ["MST", "mst"],
  ["EVP", "evp"],
  ["TP", "tp"],
];

describe("BB client stat transform vs Ephinea published tables", () => {
  for (const c of CLASSES) {
    const levels = (fixture.classes as Record<string, Record<string, Record<string, number>>>)[
      c.id
    ];
    it(`${c.id} matches at every published level`, () => {
      expect(levels).toBeDefined();
      for (const [lvStr, wiki] of Object.entries(levels)) {
        const lv = Number(lvStr);
        const ours = statsAtLevel(c.id, lv);
        for (const [wikiKey, ourKey] of STAT_KEYS) {
          if (wiki[wikiKey] === undefined || isTypo(c.id, wikiKey, lv)) continue;
          expect(ours[ourKey], `${c.id} L${lv} ${wikiKey}`).toBe(wiki[wikiKey]);
        }
        if (wiki.ATA !== undefined && !isTypo(c.id, "ATA", lv)) {
          // Wiki shows ATA to one decimal; our display value is the floor.
          expect(ours.ata, `${c.id} L${lv} ATA`).toBe(Math.floor(wiki.ATA + 1e-9));
        }
      }
    });
  }

  it("androids always have 0 TP", () => {
    for (const id of ["hucast", "hucaseal", "racast", "racaseal"]) {
      for (const lv of [1, 50, 200]) {
        expect(statsAtLevel(id, lv).tp).toBe(0);
      }
    }
  });

  it("every class has an authored ATA constant", () => {
    for (const c of CLASSES) {
      expect(CLASS_ATA_CONST_TENTHS[c.id], c.id).toBeGreaterThan(0);
    }
  });

  it("ATA caps land on the authentic displayed maxima", () => {
    // Cap = floor((max.ataTenths + class constant) / 10): the famous 200 for
    // HUmar, 218 for HUcaseal.
    const capOf = (id: string) => {
      const def = CLASSES.find((c) => c.id === id)!;
      return Math.floor((def.max.ataTenths + CLASS_ATA_CONST_TENTHS[id]) / 10);
    };
    expect(capOf("humar")).toBe(200);
    expect(capOf("hucaseal")).toBe(218);
    expect(capOf("ramar")).toBe(249);
    expect(capOf("fonewearl")).toBe(186);
  });
});
