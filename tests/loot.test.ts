import { describe, it, expect } from "vitest";
import { createRng } from "../src/engine/rng";
import { rollDrop, filterItem, DEFAULT_FILTER, sellFromInventory, type EconomyState } from "../src/engine/loot";
import { getDropTable, GEAR } from "../src/engine/content";
import type { Item } from "../src/engine/items";

describe("drop generation (seeded)", () => {
  it("reproduces the same drops for the same seed", () => {
    const table = getDropTable("forest-enemies");
    const runA = createRng("run", 1);
    const runB = createRng("run", 1);
    let a = 0;
    let b = 0;
    const mintA = () => `a-${a++}`;
    const mintB = () => `b-${b++}`;
    const seqA = Array.from({ length: 30 }, () => rollDrop(table, 0, runA, mintA));
    const seqB = Array.from({ length: 30 }, () => rollDrop(table, 0, runB, mintB));
    // Compare on the meaningful fields (ids differ by mint prefix by design).
    const strip = (o: ReturnType<typeof rollDrop>) => ({
      meseta: o.meseta,
      item: o.item?.defId ?? null,
      consumable: o.consumable,
      grinders: o.grinders,
    });
    expect(seqA.map(strip)).toEqual(seqB.map(strip));
  });

  it("higher tiers can produce rares the base tier does not", () => {
    const table = getDropTable("forest-enemies");
    const rng = createRng("tiers", 5);
    let n = 0;
    const mint = () => `x-${n++}`;
    const rares = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const d = rollDrop(table, 2, rng, mint);
      if (d.item?.rarity === "rare") rares.add(d.item.defId);
    }
    expect(rares.size).toBeGreaterThan(0);
  });
});

describe("loot filter", () => {
  const rare: Item = { ...GEAR.photonEdge, id: "r1" } as Item;
  const junk: Item = { ...GEAR.handBlade, id: "j1" } as Item;

  it("keeps rares regardless of value bar", () => {
    expect(filterItem(rare, { autoSellBelow: 100000, alwaysKeep: ["rare"] })).toBe("keep");
  });

  it("auto-sells low-value gear below the bar", () => {
    expect(filterItem(junk, DEFAULT_FILTER)).toBe("sell"); // handBlade sell 40 < 100
  });

  it("keeps gear at or above the bar", () => {
    expect(filterItem({ ...GEAR.greatBlade, id: "g" } as Item, DEFAULT_FILTER)).toBe("keep");
  });
});

describe("inventory selling", () => {
  it("removes item and credits meseta", () => {
    const econ: EconomyState = {
      meseta: 0,
      grinders: 0,
      inventory: [{ ...GEAR.greatBlade, id: "s1" } as Item],
    };
    expect(sellFromInventory(econ, "s1")).toBe(true);
    expect(econ.inventory).toHaveLength(0);
    expect(econ.meseta).toBe(GEAR.greatBlade.sellValue);
  });

  it("rejects selling a missing item", () => {
    const econ: EconomyState = { meseta: 0, grinders: 0, inventory: [] };
    expect(sellFromInventory(econ, "nope")).toBe(false);
  });
});
