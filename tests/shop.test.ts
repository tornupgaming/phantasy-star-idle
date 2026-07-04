/**
 * shop-generation spec: authentic BB shop stock — level-tiered counts,
 * section-ID weighting, attribute rolls, deterministic (characterId, level)
 * seeding — plus purchasing at authentic prices.
 * Tier boundaries and quirks cite newserv src/ItemCreator.cc.
 */

import { describe, it, expect } from "vitest";
import type { EconomyState } from "../src/engine/loot";
import type { Supply } from "../src/engine/consumables";
import type { Weapon, Tool } from "../src/engine/items";
import {
  buyConsumable,
  buyGrinders,
  buyGear,
  buyToolItem,
  generateGearStock,
  generateToolStock,
  shopDifficulty,
  weaponShopTier,
  GRINDER_PRICE,
  type ToolOffer,
} from "../src/engine/shop";
import { CONSUMABLES } from "../src/engine/consumables";
import { priceForItem } from "../src/engine/pricing";
import { memoryStorage } from "../src/engine/save";
import { Game } from "../src/engine/game";

const weaponGroup = (w: Weapon) => parseInt(w.code!.slice(2, 4), 16);
const diskOffers = (offers: ToolOffer[]) =>
  offers.filter((o): o is Extract<ToolOffer, { type: "item" }> => o.type === "item" && o.item.tech !== undefined);

describe("shop difficulty from character level", () => {
  it("maps 0-19/20-39/40-79/80+ to Normal/Hard/VeryHard/Ultimate", () => {
    expect(shopDifficulty(1)).toBe("Normal");
    expect(shopDifficulty(19)).toBe("Normal");
    expect(shopDifficulty(20)).toBe("Hard");
    expect(shopDifficulty(39)).toBe("Hard");
    expect(shopDifficulty(40)).toBe("VeryHard");
    expect(shopDifficulty(79)).toBe("VeryHard");
    expect(shopDifficulty(80)).toBe("Ultimate");
    expect(shopDifficulty(200)).toBe("Ultimate");
  });

  it("covers the Ultimate weapon tiers unreachable by the level mapping (ItemCreator.cc:1340-1369)", () => {
    // Ultimate starts at level 80 here, so tiers 0-3 are dead by construction —
    // still asserted directly so a porting mistake can't hide in them.
    expect(weaponShopTier(5, "Ultimate")).toBe(0);
    expect(weaponShopTier(25, "Ultimate")).toBe(1);
    expect(weaponShopTier(42, "Ultimate")).toBe(2);
    expect(weaponShopTier(60, "Ultimate")).toBe(3);
    expect(weaponShopTier(99, "Ultimate")).toBe(4);
    expect(weaponShopTier(150, "Ultimate")).toBe(5);
    expect(weaponShopTier(151, "Ultimate")).toBe(6);
    expect(weaponShopTier(99, "Normal")).toBe(4);
  });
});

describe("shop purchasing", () => {
  it("buys consumables at authentic prices, adding to stock", () => {
    const econ: EconomyState = { meseta: 1000, grinders: 0, inventory: [] };
    const supply: Supply = {};
    const r = buyConsumable(econ, supply, "monomate", 3);
    expect(r.ok).toBe(true);
    expect(econ.meseta).toBe(1000 - CONSUMABLES.monomate.price * 3);
    expect(supply.monomate).toBe(3);
  });

  it("rejects when meseta is insufficient", () => {
    const econ: EconomyState = { meseta: 10, grinders: 0, inventory: [] };
    const supply: Supply = {};
    expect(buyConsumable(econ, supply, "trimate", 1).ok).toBe(false);
    expect(econ.meseta).toBe(10);
    expect(supply.trimate ?? 0).toBe(0);
  });

  it("buys grinders", () => {
    const econ: EconomyState = { meseta: GRINDER_PRICE * 2, grinders: 1, inventory: [] };
    expect(buyGrinders(econ, 2).ok).toBe(true);
    expect(econ.grinders).toBe(3);
    expect(econ.meseta).toBe(0);
  });

  it("buying gear charges the authentic price and moves the item to shared inventory", () => {
    const econ: EconomyState = { meseta: 1_000_000, grinders: 0, inventory: [] };
    const stock = generateGearStock("char-1", "weapon", 1, "Viridia");
    const offer = stock.offers[0];
    const r = buyGear(econ, stock, offer.id);
    expect(r.ok).toBe(true);
    expect(econ.meseta).toBe(1_000_000 - priceForItem(offer));
    expect(econ.inventory).toEqual([offer]);
    expect(stock.offers).not.toContainEqual(offer);
    expect(buyGear(econ, stock, offer.id).ok).toBe(false); // one-shot
  });

  it("rejects gear purchases when meseta is insufficient", () => {
    const econ: EconomyState = { meseta: 1, grinders: 0, inventory: [] };
    const stock = generateGearStock("char-1", "weapon", 1, "Viridia");
    expect(buyGear(econ, stock, stock.offers[0].id).ok).toBe(false);
    expect(econ.inventory).toHaveLength(0);
  });

  it("buys one-shot tool items (tech disks) into inventory", () => {
    const econ: EconomyState = { meseta: 1_000_000, grinders: 0, inventory: [] };
    const stock = generateToolStock("char-1", 50);
    const disk = diskOffers(stock.offers)[0];
    expect(disk).toBeDefined();
    const r = buyToolItem(econ, stock, disk.item.id);
    expect(r.ok).toBe(true);
    expect(econ.inventory[0]).toBe(disk.item);
    expect(buyToolItem(econ, stock, disk.item.id).ok).toBe(false);
  });
});

describe("deterministic stock (shop-generation spec)", () => {
  it("same (characterId, level, kind) reproduces identical offers, attributes included", () => {
    const a = generateGearStock("char-1", "weapon", 30, "Skyly");
    const b = generateGearStock("char-1", "weapon", 30, "Skyly");
    expect(b.offers).toEqual(a.offers);
    const tools = generateToolStock("char-1", 30);
    expect(generateToolStock("char-1", 30).offers).toEqual(tools.offers);
    // Different character or level → different stream.
    const other = generateGearStock("char-2", "weapon", 30, "Skyly");
    const leveled = generateGearStock("char-1", "weapon", 31, "Skyly");
    expect(other.offers).not.toEqual(a.offers);
    expect(leveled.offers).not.toEqual(a.offers);
  });

  it("game regenerates all three stocks on level change and keeps them stable otherwise", () => {
    const game = Game.loadOrNew(memoryStorage(), () => 0);
    const weaponsBefore = game.shopStock("weapon");
    expect(weaponsBefore.level).toBe(1);
    game.selectedCharacter().level = 2;
    const weaponsAfter = game.shopStock("weapon");
    const armourAfter = game.shopStock("armour");
    const toolsAfter = game.toolShopStock();
    expect(weaponsAfter.level).toBe(2);
    expect(armourAfter.level).toBe(2);
    expect(toolsAfter.level).toBe(2);
    expect(weaponsAfter.offers).not.toEqual(weaponsBefore.offers);
    // Stable at the same level: asking again does not reroll.
    expect(game.shopStock("weapon")).toBe(weaponsAfter);
    expect(game.toolShopStock()).toBe(toolsAfter);
  });

  it("each character has its own stock", () => {
    const game = Game.loadOrNew(memoryStorage(), () => 0);
    game.createCharacter("Rico", "ramarl");
    const first = game.shopStock("weapon");
    game.selectCharacter(game.state.roster[1].character.id);
    const second = game.shopStock("weapon");
    expect(second.offers.map((o) => o.id)).not.toEqual(first.offers.map((o) => o.id));
  });
});

describe("armour counter (ItemCreator.cc:1007-1188)", () => {
  const countsByKind = (level: number) => {
    const offers = generateGearStock("char-1", "armour", level, "Viridia").offers;
    return {
      frames: offers.filter((o) => o.kind === "frame").length,
      barriers: offers.filter((o) => o.kind === "barrier").length,
      units: offers.filter((o) => o.kind === "unit").length,
    };
  };

  it("counts follow the level tiers (armor 4/6/7, shield 4/5/6/7, unit 0/3/5/6)", () => {
    expect(countsByKind(10)).toEqual({ frames: 4, barriers: 4, units: 0 });
    expect(countsByKind(11)).toEqual({ frames: 6, barriers: 5, units: 3 });
    expect(countsByKind(26)).toEqual({ frames: 7, barriers: 6, units: 5 });
    expect(countsByKind(43)).toEqual({ frames: 7, barriers: 7, units: 6 });
  });

  it("stocks only frames/barriers/units with no duplicate defs", () => {
    const offers = generateGearStock("char-1", "armour", 30, "Viridia").offers;
    expect(offers.every((o) => ["frame", "barrier", "unit"].includes(o.kind))).toBe(true);
    expect(new Set(offers.map((o) => o.defId)).size).toBe(offers.length);
  });
});

describe("weapon counter (ItemCreator.cc:1330-1545)", () => {
  it("counts follow the level tiers (10/12/16 at <11/<43/else)", () => {
    expect(generateGearStock("c", "weapon", 10, "Viridia").offers).toHaveLength(10);
    expect(generateGearStock("c", "weapon", 11, "Viridia").offers).toHaveLength(12);
    expect(generateGearStock("c", "weapon", 43, "Viridia").offers).toHaveLength(16);
  });

  it("draws types from the section ID's weight row", () => {
    // weapon-shop-random-set-normal.json tier 0 Viridia weights only type codes
    // 0/5/25/30/45 → Saber(01), Dagger(03), Handgun(06), Rifle(07), Cane(0A).
    const offers = generateGearStock("c", "weapon", 5, "Viridia").offers as Weapon[];
    for (const w of offers) expect([0x01, 0x03, 0x06, 0x07, 0x0a]).toContain(weaponGroup(w));
  });

  it("allows at most two entries of the same weapon type", () => {
    for (const level of [5, 25, 50]) {
      const offers = generateGearStock("c", "weapon", level, "Whitill").offers as Weapon[];
      const byGroup = new Map<number, number>();
      for (const w of offers) byGroup.set(weaponGroup(w), (byGroup.get(weaponGroup(w)) ?? 0) + 1);
      for (const n of byGroup.values()) expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("favored weapon type grinds from the favored range (TekkerAdjustmentSet)", () => {
    // Viridia favors Shot (0x09). At level 60 (grind tier 5) the favored range
    // is [3,16] vs default [0,10] — favored weapons roll grind ≥ 3.
    for (let i = 0; i < 20; i++) {
      const offers = generateGearStock(`c${i}`, "weapon", 60, "Viridia").offers as Weapon[];
      for (const w of offers) {
        if (weaponGroup(w) === 0x09 && w.maxGrind >= 3) expect(w.grind).toBeGreaterThanOrEqual(3);
        if (weaponGroup(w) !== 0x09) expect(w.grind).toBeLessThanOrEqual(10);
      }
    }
  });

  it("weapons are sold tekked with in-range bonuses", () => {
    const offers = generateGearStock("c", "weapon", 76, "Oran").offers as Weapon[];
    for (const w of offers) {
      expect(w.tekked).toBe(true);
      for (const v of Object.values(w.bonuses ?? {})) {
        expect(Math.abs(v as number)).toBeGreaterThanOrEqual(5);
        expect(Math.abs(v as number)).toBeLessThanOrEqual(50);
        expect((v as number) % 5).toBe(0);
      }
    }
  });
});

describe("tool counter (ItemCreator.cc:1190-1328)", () => {
  it("stocks the fixed common-recovery row for the tier plus a grinder", () => {
    // Tier 0 row [0,15,3,15,6,7,9,11,12,15,15] → monomate, monofluid, antidote,
    // antiparalysis, moon-atomizer, telepipe, trap-vision.
    const offers = generateToolStock("char-1", 1).offers;
    const consumables = offers
      .filter((o): o is Extract<ToolOffer, { type: "consumable" }> => o.type === "consumable")
      .map((o) => o.id);
    expect(consumables).toEqual([
      "monomate",
      "monofluid",
      "antidote",
      "antiparalysis",
      "moon-atomizer",
      "telepipe",
      "trap-vision",
    ]);
    expect(offers.filter((o) => o.type === "grinder")).toHaveLength(1);
  });

  it("tech disk counts follow the level tiers (4/5/7 at <11/<43/else)", () => {
    expect(diskOffers(generateToolStock("c", 10).offers)).toHaveLength(4);
    expect(diskOffers(generateToolStock("c", 11).offers)).toHaveLength(5);
    expect(diskOffers(generateToolStock("c", 43).offers)).toHaveLength(7);
  });

  it("tech disks carry technique, level, and disk pricing", () => {
    const disks = diskOffers(generateToolStock("char-1", 30).offers);
    const seen = new Set<number>();
    for (const { item } of disks) {
      expect(item.tech).toBeGreaterThanOrEqual(0);
      expect(seen.has(item.tech!)).toBe(false); // duplicate technique rejection
      seen.add(item.tech!);
      expect(item.techLevel).toBeGreaterThanOrEqual(1);
      expect(item.techLevel).toBeLessThanOrEqual(15);
      expect(item.name).toMatch(/^Disk:.+ Lv\.\d+$/);
      // Disk price = tool cost × level (ItemParameterTable price_for_item).
      expect(priceForItem(item) % item.techLevel!).toBe(0);
    }
  });

  it("divisor-mode disk levels follow clamp(min(L,99)/N - 1, 0, 14) + 1", () => {
    // Tier-0 Foie has PlayerLevelDivisor 3 (tool-shop-random-set.json).
    for (const [level, expected] of [
      [1, 1],
      [10, 3],
    ] as const) {
      const foie = diskOffers(generateToolStock(`c${level}`, level).offers).find((d) =>
        d.item.name.startsWith("Disk:Foie"),
      );
      if (foie) expect(foie.item.techLevel).toBe(expected);
    }
  });

  it("high-level stock may include Scape Doll as a one-shot inert item", () => {
    // Scape Doll (entry 0x0D) is rare-recovery stock; scan seeds for one.
    let found: Tool | null = null;
    for (let i = 0; i < 50 && !found; i++) {
      const offers = generateToolStock(`seed-${i}`, 61).offers;
      const doll = offers.find(
        (o): o is Extract<ToolOffer, { type: "item" }> => o.type === "item" && o.item.code === "030900",
      );
      if (doll) found = doll.item;
    }
    if (found) {
      expect(found.tech).toBeUndefined();
      expect(priceForItem(found)).toBe(10000); // authentic PMT cost
    }
  });
});
