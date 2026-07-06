/**
 * item-parameter-data spec: the generated item dataset carries authentic BB
 * values, the extraction pipeline is deterministic (byte-identical
 * regeneration), the typed loader exposes it, every weapon kind resolves to
 * frame-data timing, and speed units expose their attack-speed boost.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import dataset from "../src/engine/data/item-table.json";
import {
  allBarriers,
  allFrames,
  armorStatCeiling,
  allUnits,
  allWeapons,
  allTools,
  frameDef,
  rarityForStars,
  templateFromCode,
  unitAttackSpeedBoost,
  unitBonus,
  unitDef,
  toolDef,
  weaponDef,
} from "../src/engine/data/item-table";
import { attackStepMs } from "../src/engine/data/frame-data";
import { archetypeForWeaponKind, WEAPON_KIND_NAMES } from "../src/engine/items";
import type { Weapon, Frame, Barrier, Unit } from "../src/engine/items";

const NEWSERV_ROOT = process.env.NEWSERV_ROOT ?? "/home/psmith/projects/newserv";
const DATASET_PATH = join(__dirname, "..", "src", "engine", "data", "item-table.json");

describe("item dataset", () => {
  it("carries known Blue Burst reference values", () => {
    const saber = weaponDef("000100")!;
    expect(saber.name).toBe("Saber");
    expect(saber.atpMin).toBe(40);
    expect(saber.atpMax).toBe(55);
    expect(saber.ata).toBe(30);
    expect(saber.maxGrind).toBe(35);
    expect(saber.atpRequired).toBe(30);
    expect(saber.weaponKind).toBe(1);

    const frame = frameDef("010100")!;
    expect(frame.name).toBe("Frame");
    expect(frame.dfp).toBe(5);
    expect(frame.evp).toBe(5);

    const knightPower = unitDef("010300")!;
    expect(knightPower.name).toBe("Knight/Power");
    expect(knightPower.stat).toBe(0);
    expect(knightPower.statAmount).toBe(5);
    expect(unitBonus(knightPower)).toEqual({ atp: 5 });
  });

  it("has the expected per-kind entry counts", () => {
    const raw = dataset as unknown as Record<string, Record<string, unknown>>;
    expect(Object.keys(raw.weapons)).toHaveLength(903);
    expect(Object.keys(raw.frames)).toHaveLength(89);
    expect(Object.keys(raw.barriers)).toHaveLength(166);
    expect(Object.keys(raw.units)).toHaveLength(101);
    expect(Object.keys(raw.mags)).toHaveLength(83);
    expect(Object.keys(raw.tools)).toHaveLength(194);
  });

  it("excludes unnamed entries from iterators but resolves them by code", () => {
    for (const def of [...allWeapons(), ...allFrames(), ...allBarriers(), ...allUnits(), ...allTools()]) {
      expect(def.name).not.toBeNull();
    }
    // The bare-hands weapon entry has no name but is still addressable.
    expect(weaponDef("000000")!.name).toBeNull();
    expect(allWeapons().some((w) => w.code === "000000")).toBe(false);
  });

  it("exposes tool definitions with cost-derived sell values", () => {
    const monofluid = toolDef("030100")!;
    expect(monofluid.name).toBe("Monofluid");
    expect(monofluid.cost).toBe(100);
    expect(monofluid.sellValue).toBe(12);
    expect(allTools().some((t) => t.code === "030100")).toBe(true);
  });

  it("buckets stars into the three-tier rarity", () => {
    expect(rarityForStars(0)).toBe("common");
    expect(rarityForStars(3)).toBe("common");
    expect(rarityForStars(4)).toBe("uncommon");
    expect(rarityForStars(8)).toBe("uncommon");
    expect(rarityForStars(9)).toBe("rare");
    expect(rarityForStars(12)).toBe("rare");
  });

  it.skipIf(!existsSync(NEWSERV_ROOT))("regenerates byte-identically from newserv", () => {
    const before = readFileSync(DATASET_PATH);
    execFileSync("node", [join(__dirname, "..", "scripts", "extract-item-table.mjs")], {
      env: { ...process.env, NEWSERV_ROOT },
    });
    const after = readFileSync(DATASET_PATH);
    expect(after.equals(before)).toBe(true);
  });
});

describe("template adapter", () => {
  it("bridges a weapon definition to a valid gear template", () => {
    const t = templateFromCode("000100") as Omit<Weapon, "id">;
    expect(t.kind).toBe("weapon");
    expect(t.defId).toBe("000100");
    expect(t.name).toBe("Saber");
    expect(t.minAtp).toBe(40);
    expect(t.spread).toBe(15); // atpMax 55 − atpMin 40
    expect(t.ata).toBe(30);
    expect(t.grind).toBe(0);
    expect(t.maxGrind).toBe(35);
    expect(t.weaponType).toBe("saber");
    expect(t.rarity).toBe(rarityForStars(weaponDef("000100")!.stars));
    expect(t.sellValue).toBeGreaterThan(0);
    expect(t.requirements).toEqual({ atp: 30 });
  });

  it("bridges frame, barrier, and unit definitions", () => {
    const f = templateFromCode("010100") as Omit<Frame, "id">;
    expect(f.kind).toBe("frame");
    expect(f.dfp).toBe(5);
    expect(f.evp).toBe(5);
    expect(f.unitSlots).toBe(4);
    expect(f.sellValue).toBeGreaterThan(0);

    const firstBarrier = allBarriers()[0];
    const b = templateFromCode(firstBarrier.code) as Omit<Barrier, "id">;
    expect(b.kind).toBe("barrier");
    expect(b.dfp).toBe(firstBarrier.dfp);

    const u = templateFromCode("010300") as Omit<Unit, "id">;
    expect(u.kind).toBe("unit");
    expect(u.bonus).toEqual({ atp: 5 });
  });

  it("carries usableBy and level requirements through", () => {
    // Find a class-restricted weapon and a level-gated frame in the dataset.
    const restricted = allWeapons().find((w) => w.usableBy !== 0xff)!;
    const rt = templateFromCode(restricted.code);
    expect(rt.requirements?.usableBy).toBe(restricted.usableBy);

    const gated = allFrames().find((f) => f.requiredLevel > 0)!;
    const gt = templateFromCode(gated.code);
    expect(gt.requirements?.level).toBe(gated.requiredLevel);
  });

  it("prices no-divisor weapons at the rare flat rate (80 buy → 10 sell)", () => {
    // Every null-saleDivisor weapon in the dataset is a rare; price_for_item
    // gives rares a flat 80 before the divisor is ever consulted.
    const unsellable = allWeapons().find((w) => w.saleDivisor === null)!;
    expect(unsellable.stars).toBeGreaterThanOrEqual(9);
    expect(templateFromCode(unsellable.code).sellValue).toBe(10);
  });

  it("rejects unknown codes", () => {
    expect(() => templateFromCode("FFFFFF")).toThrow(/unknown item code/);
  });
});

describe("weapon kind speed mapping", () => {
  it("resolves every weapon kind in the dataset to frame-data timing", () => {
    const raw = dataset as unknown as { weapons: Record<string, { weaponKind: number }> };
    for (const w of Object.values(raw.weapons)) {
      expect(attackStepMs("male", w.weaponKind, "normal", 0, false, 0)).toBeGreaterThan(0);
    }
  });

  it("covers all 19 kinds totally, with a display archetype, and rejects out-of-range kinds", () => {
    expect(WEAPON_KIND_NAMES).toHaveLength(19);
    for (let kind = 0; kind < 19; kind++) {
      expect(attackStepMs("male", kind, "normal", 0, false, 0)).toBeGreaterThan(0);
      expect(archetypeForWeaponKind(kind)).toBeTruthy();
    }
    expect(() => archetypeForWeaponKind(19)).toThrow(/unknown WeaponKind/);
  });
});

describe("attack-speed units", () => {
  it("exposes the Battle series' stat-19 boosts", () => {
    const expected: Record<string, number> = {
      "01033F": 5, // General/Battle
      "010340": 10, // Devil/Battle
      "010341": 20, // God/Battle
      "010353": 40, // Heavenly/Battle
    };
    for (const [code, boost] of Object.entries(expected)) {
      const def = unitDef(code)!;
      expect(def.stat).toBe(19);
      expect(unitAttackSpeedBoost(def)).toBe(boost);
    }
  });

  it("normalizes V101's client-hardcoded speed effect to 40%", () => {
    const v101 = unitDef("010349")!;
    expect(v101.name).toBe("V101");
    expect(v101.stat).not.toBe(19); // the source entry uses an unrelated stat
    expect(unitAttackSpeedBoost(v101)).toBe(40);
  });

  it("non-speed units carry no boost and speed units flow into templates", () => {
    expect(unitAttackSpeedBoost(unitDef("010300")!)).toBe(0); // Knight/Power
    const t = templateFromCode("010353") as Omit<Unit, "id">;
    expect(t.attackSpeedBoost).toBe(40);
    const plain = templateFromCode("010300") as Omit<Unit, "id">;
    expect(plain.attackSpeedBoost).toBeUndefined();
  });
});

describe("armorStatCeiling", () => {
  it("returns base + range for frames and barriers (shop-list-card spec)", () => {
    // Frame 010100: DFP 5 range 2, EVP 5 range 2 → ceiling 7/7.
    expect(armorStatCeiling({ kind: "frame", code: "010100" })).toEqual({ dfp: 7, evp: 7 });
    const b = { kind: "barrier" as const, code: "010200" };
    const def = allBarriers().find((d) => d.code === "010200")!;
    expect(armorStatCeiling(b)).toEqual({ dfp: def.dfp + def.dfpRange, evp: def.evp + def.evpRange });
  });

  it("returns null without a code, for non-armour kinds, and for unknown codes", () => {
    expect(armorStatCeiling({ kind: "frame" })).toBeNull();
    expect(armorStatCeiling({ kind: "weapon", code: "000100" })).toBeNull();
    expect(armorStatCeiling({ kind: "barrier", code: "ffffff" })).toBeNull();
  });

  it("does not mutate its argument", () => {
    const item = { kind: "frame" as const, code: "010100" };
    armorStatCeiling(item);
    expect(item).toEqual({ kind: "frame", code: "010100" });
  });
});
