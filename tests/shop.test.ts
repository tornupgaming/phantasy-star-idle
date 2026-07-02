import { describe, it, expect } from "vitest";
import type { EconomyState } from "../src/engine/loot";
import type { Supply } from "../src/engine/consumables";
import {
  buyConsumable,
  buyGrinders,
  buyGear,
  generateGearStock,
  gearPrice,
  levelBand,
  GRINDER_PRICE,
  STOCK_SIZE,
} from "../src/engine/shop";
import { CONSUMABLES } from "../src/engine/consumables";
import { memoryStorage } from "../src/engine/save";
import { Game } from "../src/engine/game";

describe("shop purchasing", () => {
  it("buys consumables, deducting price and adding to stock", () => {
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
    const r = buyConsumable(econ, supply, "trimate", 1);
    expect(r.ok).toBe(false);
    expect(econ.meseta).toBe(10);
    expect(supply.trimate ?? 0).toBe(0);
  });

  it("buys grinders", () => {
    const econ: EconomyState = { meseta: GRINDER_PRICE * 2, grinders: 1, inventory: [] };
    expect(buyGrinders(econ, 2).ok).toBe(true);
    expect(econ.grinders).toBe(3);
    expect(econ.meseta).toBe(0);
  });
});

describe("per-character gear stocks (loot-economy spec, pioneer2-hub-redesign)", () => {
  it("level bands are 5 levels wide", () => {
    expect(levelBand(1)).toBe(0);
    expect(levelBand(5)).toBe(0);
    expect(levelBand(6)).toBe(1);
    expect(levelBand(200)).toBe(39);
  });

  it("stock is deterministic for (kind, characterId, band, restock)", () => {
    const a = generateGearStock("char-1", "weapon", 1, 0);
    const b = generateGearStock("char-1", "weapon", 1, 0);
    expect(b.offers).toEqual(a.offers);
    // Different kind, character, band, or restock counter → different stream.
    const armour = generateGearStock("char-1", "armour", 1, 0);
    const other = generateGearStock("char-2", "weapon", 1, 0);
    const rerolled = generateGearStock("char-1", "weapon", 1, 1);
    expect([armour.offers, other.offers, rerolled.offers]).not.toContainEqual(a.offers);
  });

  it("stocks are segregated by kind: weapons vs frames/barriers/units", () => {
    const weapons = generateGearStock("char-1", "weapon", 2, 0);
    expect(weapons.offers.length).toBeGreaterThan(0);
    expect(weapons.offers.every((o) => o.kind === "weapon")).toBe(true);
    const armour = generateGearStock("char-1", "armour", 2, 0);
    expect(armour.offers.length).toBeGreaterThan(0);
    expect(armour.offers.every((o) => ["frame", "barrier", "unit"].includes(o.kind))).toBe(true);
  });

  it("offers only band-eligible gear, up to the stock size, without duplicates", () => {
    for (const kind of ["weapon", "armour"] as const) {
      const band0 = generateGearStock("char-1", kind, 0, 0);
      expect(band0.offers.length).toBeGreaterThanOrEqual(2); // both counters stocked from level 1
      const band2 = generateGearStock("char-1", kind, 2, 0);
      expect(band2.offers).toHaveLength(STOCK_SIZE);
      expect(new Set(band2.offers.map((o) => o.defId)).size).toBe(band2.offers.length);
    }
  });

  it("buying gear deducts shared meseta and moves the item to shared inventory", () => {
    const econ: EconomyState = { meseta: 100_000, grinders: 0, inventory: [] };
    const stock = generateGearStock("char-1", "weapon", 1, 0);
    const offer = stock.offers[0];
    const r = buyGear(econ, stock, offer.id);
    expect(r.ok).toBe(true);
    expect(econ.meseta).toBe(100_000 - gearPrice(offer));
    expect(econ.inventory).toEqual([offer]);
    expect(stock.offers).not.toContainEqual(offer); // offer consumed
    expect(buyGear(econ, stock, offer.id).ok).toBe(false); // can't buy twice
  });

  it("rejects gear purchases when meseta is insufficient", () => {
    const econ: EconomyState = { meseta: 1, grinders: 0, inventory: [] };
    const stock = generateGearStock("char-1", "weapon", 1, 0);
    expect(buyGear(econ, stock, stock.offers[0].id).ok).toBe(false);
    expect(econ.inventory).toHaveLength(0);
  });

  it("game regenerates both stocks when the character's level band changes", () => {
    const game = Game.loadOrNew(memoryStorage(), () => 0);
    const weaponsBefore = game.shopStock("weapon");
    const armourBefore = game.shopStock("armour");
    expect(weaponsBefore.band).toBe(0);
    game.selectedCharacter().level = 7; // band 1
    const weaponsAfter = game.shopStock("weapon");
    const armourAfter = game.shopStock("armour");
    for (const [before, after] of [
      [weaponsBefore, weaponsAfter],
      [armourBefore, armourAfter],
    ] as const) {
      expect(after.band).toBe(1);
      expect(after.restock).toBe(before.restock + 1);
    }
    // Stable within the band: asking again does not reroll.
    expect(game.shopStock("weapon")).toBe(weaponsAfter);
    expect(game.shopStock("armour")).toBe(armourAfter);
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
