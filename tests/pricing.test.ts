/**
 * item-pricing spec: authentic price_for_item port. Reference values hand-
 * computed from the formulas in newserv src/ItemParameterTable.cc:2336-2410
 * against the extracted PMT data (Saber atpMax 55 / saleDivisor 15, Frame
 * 5+5 DFP/EVP / armor divisor ~0.8, Barrier 2+25 / shield divisor 1.5,
 * Knight/Power 2★ / unit divisor 1000).
 */

import { describe, expect, it } from "vitest";
import type { Weapon, Frame, Barrier, Unit, Tool } from "../src/engine/items";
import { priceForItem, sellPrice } from "../src/engine/pricing";
import { templateFromCode } from "../src/engine/data/item-table";

const mint = <T,>(code: string, over: Partial<T> = {}): T =>
  ({ ...(templateFromCode(code) as object), id: "t", ...over }) as T;

describe("weapon pricing", () => {
  // price = 1000·specialStars² + (atpMax+grind)²/saleDivisor · bonusFactor/100,
  // float math, truncated once at the end.
  it("base Saber prices at 605", () => {
    expect(priceForItem(mint<Weapon>("000100"))).toBe(605);
  });

  it("grind feeds the ATP term: Saber +5 → 720", () => {
    expect(priceForItem(mint<Weapon>("000100", { grind: 5 }))).toBe(720);
  });

  it("special adds 1000·stars²: 1-star special Saber → 1605", () => {
    // Special index 1 (Draw) has star value 1 in the extracted specials table.
    expect(priceForItem(mint<Weapon>("000100", { special: 1 }))).toBe(1605);
  });

  it("bonuses shift the factor by their sum: +15 native / -10 hit → 615", () => {
    expect(priceForItem(mint<Weapon>("000100", { bonuses: { native: 15, hit: -10 } }))).toBe(615);
  });

  it("untekked weapons are flat 8, rares flat 80", () => {
    expect(priceForItem(mint<Weapon>("000100", { tekked: false }))).toBe(8);
    expect(priceForItem(mint<Weapon>("000100", { stars: 9 }))).toBe(80);
  });
});

describe("armor pricing", () => {
  // price = ⌊(dfp+evp)²/divisor⌋ + 70·(slots+1)·(requiredLevel+1).
  it("Frame prices by slots: 0 slots → 195, 4 slots → 475", () => {
    expect(priceForItem(mint<Frame>("010100", { unitSlots: 0, slots: 0 }))).toBe(195);
    expect(priceForItem(mint<Frame>("010100", { unitSlots: 4, slots: 4 }))).toBe(475);
  });

  it("Barrier prices at 556", () => {
    expect(priceForItem(mint<Barrier>("010200"))).toBe(556);
  });

  it("units price at stars × unit divisor: Knight/Power (2★) → 2000", () => {
    expect(priceForItem(mint<Unit>("010300"))).toBe(2000);
  });
});

describe("tool pricing", () => {
  it("plain tools price at PMT cost; tech disks at cost × level", () => {
    const tool: Tool = {
      kind: "tool", id: "t", defId: "030100", code: "030100",
      name: "Monofluid", rarity: "common", stars: 0, sellValue: 12,
    };
    expect(priceForItem(tool)).toBe(100);
    const disk: Tool = { ...tool, defId: "030200", code: "030200", name: "Disk:Foie Lv.3", tech: 0, techLevel: 3 };
    expect(priceForItem(disk)).toBe(300); // Foie disk cost 100 × level 3
  });
});

describe("sell-back", () => {
  it("sell value is price >> 3 everywhere", () => {
    const saber = mint<Weapon>("000100");
    expect(sellPrice(saber)).toBe(605 >> 3); // 75
    expect(sellPrice(mint<Barrier>("010200"))).toBe(556 >> 3);
  });

  it("template sellValue is stamped from the same rule", () => {
    expect(templateFromCode("000100").sellValue).toBe(75);
  });
});
