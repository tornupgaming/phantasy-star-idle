/**
 * attack-frame-data spec: the generated frame dataset is a faithful
 * transcription of the pinned pioneer2.net wikitext (measured cells match the
 * wiki exactly), unmeasured 0% cells are reconstructed and marked, extraction
 * is deterministic, and all 19 weapon kinds are covered at both anchors.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import dataset from "../src/engine/data/frame-data.json";

const DATASET_PATH = join(__dirname, "..", "src", "engine", "data", "frame-data.json");
const SCRIPT_PATH = join(__dirname, "..", "scripts", "extract-frame-data.mjs");

const ALL_KINDS = [
  "fist", "saber", "sword", "dagger", "partisan", "slicer", "handgun",
  "rifle", "mechgun", "shot", "cane", "rod", "wand", "claw", "double-saber",
  "twin-sword", "katana", "launcher", "card",
];
const POSITIONS = ["full1", "combo1", "full2", "combo2", "full3"] as const;

type Cell = Record<(typeof POSITIONS)[number], number>;
type TierEntry = { v101: Cell; base: Cell; baseReconstructed: boolean };
const rigs = dataset.rigs as Record<string, Record<string, Record<string, TierEntry>>>;

describe("frame dataset", () => {
  it("carries known wiki-measured cells at both anchors", () => {
    // Male saber Normal (wiki tables 1 and 7).
    expect(rigs.male.saber.normal.v101).toEqual({ full1: 29, combo1: 13, full2: 24, combo2: 10, full3: 31 });
    expect(rigs.male.saber.normal.base).toEqual({ full1: 32, combo1: 16, full2: 28, combo2: 14, full3: 40 });
    expect(rigs.male.saber.normal.baseReconstructed).toBe(false);
    // Male handgun Normal (wiki tables 1 and 7).
    expect(rigs.male.handgun.normal.v101.combo1).toBe(14);
    expect(rigs.male.handgun.normal.base.combo1).toBe(18);
    // Heavy is measured separately and is slower than Normal.
    expect(rigs.male.saber.heavy.v101).toEqual({ full1: 37, combo1: 21, full2: 29, combo2: 15, full3: 34 });
    // Sparse rig overrides transcribe their measured cells (delta annotations stripped).
    expect(rigs.female.saber.normal.v101.full2).toBe(26); // wiki: "26 (+2)"
    expect(rigs.female.saber.normal.base.full3).toBe(46); // wiki table 8: "46 (+6)"
    expect(rigs.hucaseal.dagger.heavy.base.full1).toBe(48); // wiki table 9: "48 (-4)"
  });

  it("covers all 19 weapon kinds on the male rig, both tiers, both anchors", () => {
    for (const kind of ALL_KINDS) {
      for (const tier of ["normal", "heavy"] as const) {
        const entry = rigs.male[kind]?.[tier];
        expect(entry, `male/${kind}/${tier}`).toBeDefined();
        for (const pos of POSITIONS) {
          expect(entry.v101[pos], `male/${kind}/${tier}.v101.${pos}`).toBeGreaterThan(0);
          expect(entry.base[pos], `male/${kind}/${tier}.base.${pos}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("marks wiki-measured 0% cells as measured and the rest as reconstructed", () => {
    const measuredMaleKinds = ["saber", "sword", "dagger", "partisan", "handgun", "mechgun"];
    for (const kind of ALL_KINDS) {
      const expectReconstructed = !measuredMaleKinds.includes(kind);
      expect(rigs.male[kind].normal.baseReconstructed, `male/${kind}/normal`).toBe(expectReconstructed);
      expect(rigs.male[kind].heavy.baseReconstructed, `male/${kind}/heavy`).toBe(expectReconstructed);
    }
    expect(rigs.female.saber.normal.baseReconstructed).toBe(false);
    expect(rigs.hucaseal.dagger.normal.baseReconstructed).toBe(false);
    // Rigs with no 0% table at all are fully reconstructed.
    expect(rigs.ramarl.handgun.normal.baseReconstructed).toBe(true);
  });

  it("reconstructs 0% cells from the per-position median ratios", () => {
    const ratios = dataset.medianRatio as Record<(typeof POSITIONS)[number], number>;
    for (const pos of POSITIONS) {
      expect(ratios[pos]).toBeGreaterThan(1); // 0% is always slower than +40%
      expect(ratios[pos]).toBeLessThan(1.5);
      const expected = Math.round(rigs.male.rifle.normal.v101[pos] * ratios[pos]);
      expect(rigs.male.rifle.normal.base[pos]).toBe(expected);
    }
  });

  it("0% anchor is never faster than the +40% anchor", () => {
    for (const [rig, kinds] of Object.entries(rigs)) {
      for (const [kind, tiers] of Object.entries(kinds)) {
        for (const [tier, entry] of Object.entries(tiers)) {
          for (const pos of POSITIONS) {
            expect(entry.base[pos], `${rig}/${kind}/${tier}.${pos}`).toBeGreaterThanOrEqual(entry.v101[pos]);
          }
        }
      }
    }
  });

  it("regenerates byte-identically from the pinned snapshot", () => {
    const before = readFileSync(DATASET_PATH, "utf8");
    execFileSync(process.execPath, [SCRIPT_PATH], { stdio: "pipe" });
    const after = readFileSync(DATASET_PATH, "utf8");
    expect(after).toBe(before);
  });
});
