import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "../src/engine/rng";
import { barrierDef, frameDef, weaponDef } from "../src/engine/data/item-table";
import {
  commonDropTable,
  enemyRtIndex,
  generateCommonBarrier,
  generateCommonFrame,
  generateCommonTool,
  generateCommonUnit,
  generateCommonWeapon,
  mintRareItem,
  rollBoxMeseta,
  rollEnemyMeseta,
  rareDropSpecs,
  rollBoxDropPipeline,
  rollEnemyDropPipeline,
  sampleWeightedColumn,
  sampleWeightedIndex,
} from "../src/engine/drop-gen";

function fixedInts(...values: number[]): Rng {
  let i = 0;
  return {
    next: () => 0,
    int: () => values[i++] ?? 0,
    chance: () => false,
    float: () => 0,
    pick: (items) => items[0],
  };
}

function scriptedRng(chances: boolean[], ints: number[] = []): Rng {
  let c = 0;
  let i = 0;
  return {
    next: () => 0,
    int: () => ints[i++] ?? 0,
    chance: () => chances[c++] ?? false,
    float: () => 0,
    pick: (items) => items[0],
  };
}

describe("drop-gen dataset access", () => {
  it("resolves common tables, rare specs, and enemy rt-index metadata", () => {
    expect(commonDropTable("Normal", "Viridia").BaseWeaponTypeProbTable[0]).toBe(13);
    expect(rareDropSpecs("Normal", "Viridia", "NAR_LILY")[0]).toMatchObject({ code: "010305", kind: "unit" });
    expect(enemyRtIndex("AL_RAPPY")).toMatchObject({ rtIndex: 6, rare: true });
    expect(enemyRtIndex("NO_SUCH_ENEMY")).toBeNull();
  });
});

describe("drop pipelines", () => {
  const context = { difficulty: "Normal" as const, sectionId: "Viridia" as const, areaNorm: 0 };

  it("stops enemy generation when drop-anything fails", () => {
    expect(rollEnemyDropPipeline("BOOMA", context, scriptedRng([false]))).toEqual({
      kind: "nothing",
      reason: "drop-anything-failed",
    });
  });

  it("checks enemy rares after drop-anything and before common class", () => {
    const decision = rollEnemyDropPipeline("NAR_LILY", context, scriptedRng([true, true]));
    expect(decision.kind).toBe("rare");
    if (decision.kind === "rare") expect(decision.spec.code).toBe("010305");
  });

  it("falls through to enemy common item class when no rare hits", () => {
    expect(rollEnemyDropPipeline("BOOMA", context, scriptedRng([true, false]))).toEqual({
      kind: "common",
      itemClass: "weapon",
    });
  });

  it("matches drop-anything rates within tolerance over many seeded trials", () => {
    const rng = createRng("dar-sanity", 1);
    let dropped = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      const decision = rollEnemyDropPipeline("BOOMA", context, rng);
      if (!(decision.kind === "nothing" && decision.reason === "drop-anything-failed")) dropped += 1;
    }
    expect(dropped / trials).toBeGreaterThan(0.26);
    expect(dropped / trials).toBeLessThan(0.30);
  });

  it("rolls box rares before common item-class selection", () => {
    const rare = rollBoxDropPipeline(
      { difficulty: "Hard", sectionId: "Viridia", areaNorm: 5 },
      scriptedRng([true]),
    );
    expect(rare.kind).toBe("rare");

    const common = rollBoxDropPipeline(context, scriptedRng([false, false], [0]));
    expect(common).toEqual({ kind: "common", itemClass: "weapon" });
  });
});

describe("rare item minting", () => {
  it("mints rare weapons from item code with forced rarity and deterministic bonuses", () => {
    const context = { difficulty: "Normal" as const, sectionId: "Bluefull" as const, areaNorm: 5 };
    const spec = rareDropSpecs(context.difficulty, context.sectionId, "GILLCHIC").find((s) => s.kind === "weapon")!;
    const a = mintRareItem(spec, context, createRng("rare-mint", 1), () => "rw-1");
    const b = mintRareItem(spec, context, createRng("rare-mint", 1), () => "rw-2");
    expect(a.kind).toBe("weapon");
    expect(a).toMatchObject({ id: "rw-1", code: spec.code, rarity: "rare" });
    expect(a.kind === "weapon" ? a.grind : null).toBe(0);
    expect(a.kind === "weapon" ? a.bonuses : null).toEqual(b.kind === "weapon" ? b.bonuses : null);
  });

  it("mints rare units from item code with forced rarity", () => {
    const context = { difficulty: "Normal" as const, sectionId: "Viridia" as const, areaNorm: 0 };
    const spec = rareDropSpecs(context.difficulty, context.sectionId, "NAR_LILY")[0];
    const item = mintRareItem(spec, context, createRng("rare-unit", 1), () => "ru-1");
    expect(item).toMatchObject({ kind: "unit", id: "ru-1", code: "010305", rarity: "rare" });
  });
});

describe("common tool and meseta generation", () => {
  const context = { difficulty: "Normal" as const, sectionId: "Viridia" as const, areaNorm: 0 };

  it("routes mates to consumable supply outcomes", () => {
    expect(generateCommonTool(context, fixedInts(0), () => "tool")).toEqual({
      kind: "consumable",
      id: "monomate",
      count: 1,
    });
  });

  it("routes grinders to fungible grinder counts", () => {
    expect(generateCommonTool(context, fixedInts(9100), () => "tool")).toEqual({ kind: "grinders", count: 2 });
  });

  it("mints other tools as inert sellable items", () => {
    const outcome = generateCommonTool(context, fixedInts(4320), () => "tool-1");
    expect(outcome.kind).toBe("item");
    if (outcome.kind === "item") {
      expect(outcome.item).toMatchObject({ kind: "tool", id: "tool-1", code: "030100", name: "Monofluid" });
      expect(outcome.item.sellValue).toBeGreaterThan(0);
    }
  });

  it("rolls enemy and box meseta ranges with the economy multiplier", () => {
    expect(rollEnemyMeseta("BOOMA", context, fixedInts(5), 2)).toBe(10);
    expect(rollBoxMeseta(context, fixedInts(20), 3)).toBe(60);
  });
});

describe("common armor, shield, and unit generation", () => {
  it("generates frame slots and DFP/EVP variance within definition ranges", () => {
    const context = { difficulty: "Hard" as const, sectionId: "Viridia" as const, areaNorm: 3 };
    const rng = createRng("common-frame", 1);
    let n = 0;
    for (let i = 0; i < 20; i++) {
      const frame = generateCommonFrame(context, rng, () => `f-${n++}`)!;
      const def = frameDef(frame.code!)!;
      expect(frame.slots).toBe(frame.unitSlots);
      expect(frame.slots).toBeGreaterThanOrEqual(0);
      expect(frame.slots).toBeLessThanOrEqual(4);
      expect(frame.dfp).toBeGreaterThanOrEqual(def.dfp);
      expect(frame.dfp).toBeLessThanOrEqual(def.dfp + Math.max(0, def.dfpRange - 1));
      expect(frame.evp).toBeGreaterThanOrEqual(def.evp);
      expect(frame.evp).toBeLessThanOrEqual(def.evp + Math.max(0, def.evpRange - 1));
    }
  });

  it("generates shield variance within definition ranges", () => {
    const context = { difficulty: "Ultimate" as const, sectionId: "Redria" as const, areaNorm: 5 };
    const barrier = generateCommonBarrier(context, createRng("common-barrier", 2), () => "b-1")!;
    const def = barrierDef(barrier.code!)!;
    expect(barrier.dfp).toBeGreaterThanOrEqual(def.dfp);
    expect(barrier.dfp).toBeLessThanOrEqual(def.dfp + Math.max(0, def.dfpRange - 1));
    expect(barrier.evp).toBeGreaterThanOrEqual(def.evp);
    expect(barrier.evp).toBeLessThanOrEqual(def.evp + Math.max(0, def.evpRange - 1));
  });

  it("generates units below the area's max star cap", () => {
    const context = { difficulty: "Ultimate" as const, sectionId: "Viridia" as const, areaNorm: 8 };
    const cap = commonDropTable(context.difficulty, context.sectionId).UnitMaxStarsTable[context.areaNorm];
    const unit = generateCommonUnit(context, createRng("common-unit", 3), () => "u-1")!;
    expect(unit.stars).toBeLessThan(cap);
  });
});

describe("common weapon generation", () => {
  it("generates valid weapon codes with legal grinds deterministically", () => {
    const context = { difficulty: "Hard" as const, sectionId: "Bluefull" as const, areaNorm: 2 };
    const a = createRng("common-weapon", 77);
    const b = createRng("common-weapon", 77);
    let ai = 0;
    let bi = 0;
    const seqA = Array.from({ length: 50 }, () => generateCommonWeapon(context, a, () => `a-${ai++}`));
    const seqB = Array.from({ length: 50 }, () => generateCommonWeapon(context, b, () => `b-${bi++}`));

    expect(seqA.map((w) => ({ code: w?.code, grind: w?.grind, bonuses: w?.bonuses, special: w?.special }))).toEqual(
      seqB.map((w) => ({ code: w?.code, grind: w?.grind, bonuses: w?.bonuses, special: w?.special })),
    );
    for (const weapon of seqA) {
      expect(weapon).not.toBeNull();
      const def = weaponDef(weapon!.code!)!;
      expect(def).not.toBeNull();
      expect(weapon!.grind).toBeGreaterThanOrEqual(0);
      expect(weapon!.grind).toBeLessThanOrEqual(def.maxGrind);
    }
  });
});

describe("index-probability sampler", () => {
  it("samples indexes using integer weighted ranges", () => {
    expect(sampleWeightedIndex([2, 3, 5], fixedInts(0))).toBe(0);
    expect(sampleWeightedIndex([2, 3, 5], fixedInts(2))).toBe(1);
    expect(sampleWeightedIndex([2, 3, 5], fixedInts(9))).toBe(2);
  });

  it("ignores zero weights and is deterministic with seeded RNG", () => {
    expect(sampleWeightedIndex([0, 0, 7], fixedInts(0))).toBe(2);
    expect(sampleWeightedIndex([0, 0, 0], fixedInts(0))).toBeNull();

    const a = createRng("weighted", 123);
    const b = createRng("weighted", 123);
    const weights = [13, 6, 7, 10, 1, 13, 6, 6, 11, 13, 7, 7];
    expect(Array.from({ length: 20 }, () => sampleWeightedIndex(weights, a))).toEqual(
      Array.from({ length: 20 }, () => sampleWeightedIndex(weights, b)),
    );
  });

  it("samples vertical columns from 2D tables", () => {
    expect(sampleWeightedColumn([[0, 4], [5, 0], [0, 6]], 0, fixedInts(0))).toBe(1);
    expect(sampleWeightedColumn([[0, 4], [5, 0], [0, 6]], 1, fixedInts(4))).toBe(2);
  });
});
