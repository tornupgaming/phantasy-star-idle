import { describe, expect, it } from "vitest";
import common from "../src/engine/data/common-drop-table.json";
import rare from "../src/engine/data/rare-drop-table.json";
import { barrierDef, frameDef, unitDef, weaponDef } from "../src/engine/data/item-table";

const commonData = common as unknown as {
  techDiskToolClassId: number;
  enemyRtIndex: Record<string, { rtIndex: number; rare: boolean; boss: boolean }>;
  tables: Record<string, Record<string, Record<string, unknown>>>;
};

const rareData = rare as unknown as {
  tables: Record<string, Record<string, Record<string, Array<{ probability: number; probabilityRaw: number | string; code: string; kind: string }>>>>;
};

function isGearCode(code: string): boolean {
  return Boolean(weaponDef(code) || frameDef(code) || barrierDef(code) || unitDef(code));
}

describe("common drop dataset", () => {
  it("carries hand-verified source cells for fully specified and inherited scenarios", () => {
    const normalViridia = commonData.tables.Normal.Viridia;
    expect(normalViridia.BaseWeaponTypeProbTable).toEqual([13, 6, 7, 10, 1, 13, 6, 6, 11, 13, 7, 7]);
    expect(normalViridia.ArmorSlotCountProbTable).toEqual([77, 17, 5, 1, 0]);
    expect((normalViridia.EnemyTypeDropProbs as Record<string, number>).BOOMA).toBe(28);

    // Ep1 Normal-mode Hard Bluefull only overrides weapon type + subtype area length in source;
    // the resolved dataset inherits the armor slot table through the previous-section chain.
    expect(commonData.tables.Hard.Bluefull.BaseWeaponTypeProbTable).toEqual([13, 7, 6, 13, 6, 13, 7, 7, 4, 13, 10, 1]);
    expect(commonData.tables.Hard.Bluefull.ArmorSlotCountProbTable).toEqual([70, 19, 7, 3, 1]);
  });

  it("zeros tech-disk tool-class weights in every emitted scenario", () => {
    for (const sections of Object.values(commonData.tables)) {
      for (const table of Object.values(sections)) {
        const toolRows = table.ToolClassProbTable as number[][];
        expect(toolRows[commonData.techDiskToolClassId]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      }
    }
  });

  it("emits rt-index metadata for every wired enemy including rare variants", () => {
    expect(commonData.enemyRtIndex.AL_RAPPY).toMatchObject({ rtIndex: 6, rare: true });
    expect(commonData.enemyRtIndex.NAR_LILY).toMatchObject({ rtIndex: 14, rare: true });
    expect(commonData.enemyRtIndex.DRAGON).toMatchObject({ rtIndex: 44, boss: true });
    expect(commonData.enemyRtIndex.MONEST.rtIndex).toBe(4);
  });
});

describe("rare drop dataset", () => {
  it("normalizes integer and fraction probabilities equivalently", () => {
    const numeric = rareData.tables.Hard.Viridia["Box-Mine1"].find((spec) => spec.probabilityRaw === 2359296)!;
    expect(numeric.code).toBe("01024C");
    expect(numeric.probability).toBe(2359296 / 0x100000000);
    expect(numeric.probability).toBe(9 / 16384);
  });

  it("retains only gear item codes", () => {
    let count = 0;
    for (const sections of Object.values(rareData.tables)) {
      for (const wheres of Object.values(sections)) {
        for (const specs of Object.values(wheres)) {
          for (const spec of specs) {
            count += 1;
            expect(isGearCode(spec.code)).toBe(true);
            expect(["weapon", "frame", "barrier", "unit"]).toContain(spec.kind);
          }
        }
      }
    }
    expect(count).toBeGreaterThan(0);
  });
});
