/**
 * authentic-shop-inventory spec (run-simulation delta): Very Hard sits between
 * Hard and Ultimate, uses the authentic vhard stat rows and the VeryHard drop
 * tables, and scales meseta x3.
 */

import { describe, expect, it } from "vitest";
import { DIFFICULTIES, difficulty } from "../src/engine/areas";
import { commonDropTable, rareDropSpecs } from "../src/engine/drop-gen";
import { instantiateEnemy } from "../src/engine/enemies";
import { getEnemyDef } from "../src/engine/content";

describe("Very Hard difficulty", () => {
  it("is ordered between Hard and Ultimate with mesetaMult 3", () => {
    expect(Object.keys(DIFFICULTIES)).toEqual(["normal", "hard", "vhard", "ultimate"]);
    expect(difficulty("vhard")).toMatchObject({
      label: "Very Hard",
      dropKey: "VeryHard",
      mesetaMult: 3,
    });
  });

  it("uses the authentic vhard enemy stat rows", () => {
    // newserv battle-params Solo Ep1 Very Hard: Booma 725 HP / 610 ATP / 90 EXP.
    const booma = instantiateEnemy(getEnemyDef("booma"), "vhard");
    expect(booma.hp).toBe(725);
    expect(booma.stats.atp).toBe(610);
    expect(booma.stats.exp).toBe(90);
  });

  it("carries VeryHard drop tables with source-exact cells", () => {
    // common-table-v3-v4.json "Ep1:Normal:VeryHard:Viridia" specifies these
    // keys explicitly (slots [72,17,7,3,1], armor index [20,36,35,8,1]) ...
    const table = commonDropTable("VeryHard", "Viridia");
    expect(table.ArmorSlotCountProbTable).toEqual([72, 17, 7, 3, 1]);
    expect(table.ArmorShieldTypeIndexProbTable).toEqual([20, 36, 35, 8, 1]);
    // ... and omits BaseWeaponTypeProbTable, which inherits from Hard Viridia.
    expect(table.BaseWeaponTypeProbTable).toEqual(
      commonDropTable("Hard", "Viridia").BaseWeaponTypeProbTable,
    );
    // Rare specs are sliced for VeryHard across section IDs.
    expect(rareDropSpecs("VeryHard", "Viridia", "NAR_LILY").length).toBeGreaterThan(0);
  });
});
