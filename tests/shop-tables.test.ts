/**
 * shop-table-data spec: the extracted shop random-set dataset carries the
 * newserv tables and code constants exactly, and regenerates byte-identically.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SHOP_TABLES,
  TOOL_SHOP_NOTHING,
  sectionIdIndex,
  toolCodeForEntry,
  weaponCodeForTypeCode,
  weaponShopTables,
} from "../src/engine/data/shop-tables";
import { toolDef, weaponDef } from "../src/engine/data/item-table";

const NEWSERV_ROOT = process.env.NEWSERV_ROOT ?? "/home/psmith/projects/newserv";
const DATASET_PATH = join(__dirname, "..", "src", "engine", "data", "shop-tables.json");

describe("shop random-set dataset", () => {
  it("carries source-exact table cells", () => {
    // armor-shop-random-set.json ArmorTable tier 0 head.
    expect(SHOP_TABLES.armor.armorTable[0].slice(0, 5)).toEqual([
      [0, 33],
      [1, 33],
      [2, 15],
      [3, 10],
      [4, 5],
    ]);
    // tool-shop-random-set.json CommonRecoveryTable tier 0 (fixed stock row).
    expect(SHOP_TABLES.tool.commonRecoveryTable[0]).toEqual([0, 15, 3, 15, 6, 7, 9, 11, 12, 15, 15]);
    // RareRecoveryTable tier 1.
    expect(SHOP_TABLES.tool.rareRecoveryTable[1]).toEqual([
      [2, 25],
      [5, 25],
      [8, 24],
      [10, 0],
      [13, 0],
      [14, 1],
      [15, 25],
    ]);
    // weapon-shop-random-set-normal.json WeaponTypeWeightTables tier 0 Viridia.
    expect(weaponShopTables("Normal").typeWeightTables[0][sectionIdIndex("Viridia")]).toEqual([
      [0, 25],
      [5, 15],
      [25, 25],
      [30, 15],
      [45, 20],
    ]);
    // SpecialModeTable tier 7 (level 76+): mostly high-tier specials.
    expect(weaponShopTables("Normal").specialModeTable[7]).toEqual([
      [0, 10],
      [1, 10],
      [2, 80],
    ]);
    expect(weaponShopTables("Normal").favoredGrindRangeTable[5]).toEqual([3, 16]);
    // Ultimate has 7 level tiers (extends past level 100/151); others have 5.
    expect(weaponShopTables("Ultimate").typeWeightTables).toHaveLength(7);
    expect(weaponShopTables("Hard").typeWeightTables).toHaveLength(5);
    expect(weaponShopTables("VeryHard").typeWeightTables).toHaveLength(5);
  });

  it("resolves code constants to real items", () => {
    // ShopRandomSets.cc item_defs: 0x00 Monomate, 0x09 Moon Atomizer, 0x0F nothing.
    expect(toolCodeForEntry(0x00)).toBe("030000");
    expect(toolDef(toolCodeForEntry(0x09)!)?.name).toBe("Moon Atomizer");
    expect(toolCodeForEntry(TOOL_SHOP_NOTHING)).toBeNull();
    // type_defs: 0x00 Saber, 0x1D Raygun; 0x39/0x3A per section ID.
    expect(weaponDef(weaponCodeForTypeCode(0x00, 0))?.name).toBe("Saber");
    expect(weaponDef(weaponCodeForTypeCode(0x1d, 0))?.name).toBe("Raygun");
    expect(weaponDef(weaponCodeForTypeCode(0x39, sectionIdIndex("Viridia")))?.name).toBe(
      "HARISEN BATTLE FAN",
    );
    expect(weaponDef(weaponCodeForTypeCode(0x3a, sectionIdIndex("Whitill")))?.name).toBe("CRAZY TUNE");
    // Every non-null type code resolves to a real weapon def.
    for (const code of SHOP_TABLES.weaponTypeDefs) {
      if (code !== null) expect(weaponDef(code), code ?? "").toBeTruthy();
    }
    for (const code of [...SHOP_TABLES.weaponTypeDefs39, ...SHOP_TABLES.weaponTypeDefs3A]) {
      expect(weaponDef(code), code).toBeTruthy();
    }
    // TekkerAdjustmentSet favored types: Viridia Shot (0x09), Redria none.
    expect(SHOP_TABLES.favoredWeaponType[sectionIdIndex("Viridia")]).toBe(0x09);
    expect(SHOP_TABLES.favoredWeaponType[sectionIdIndex("Redria")]).toBeNull();
    // bonus_values: 20 entries, no zero.
    expect(SHOP_TABLES.bonusValues).toHaveLength(20);
    expect(SHOP_TABLES.bonusValues).not.toContain(0);
    // tech_num_map order: Foie first, Megid last (19 techniques).
    expect(SHOP_TABLES.tool.techNumMap[0]).toEqual({ tech: 0x00, name: "Foie" });
    expect(SHOP_TABLES.tool.techNumMap[18]).toEqual({ tech: 0x12, name: "Megid" });
  });

  it("tech disk level modes cover all three variants", () => {
    // tool-shop-random-set.json TechDiskLevelTable tier 0: Foie is divisor 3.
    expect(SHOP_TABLES.tool.techDiskLevelTable[0][0]).toEqual({ PlayerLevelDivisor: 3 });
    const modes = SHOP_TABLES.tool.techDiskLevelTable.flat();
    expect(modes.some((m) => m.PlayerLevelDivisor !== undefined)).toBe(true);
    expect(modes.some((m) => m.MinLevel !== undefined && m.MaxLevel !== undefined)).toBe(true);
    expect(modes.some((m) => Object.keys(m).length === 0)).toBe(true);
  });

  // Regeneration requires the local newserv clone; skip where it isn't present.
  it.skipIf(!existsSync(NEWSERV_ROOT))("regenerates byte-identically from newserv", () => {
    const before = readFileSync(DATASET_PATH);
    execFileSync("node", [join(__dirname, "..", "scripts", "extract-shop-tables.mjs")], {
      env: { ...process.env, NEWSERV_ROOT },
    });
    const after = readFileSync(DATASET_PATH);
    expect(after.equals(before)).toBe(true);
  });
});
