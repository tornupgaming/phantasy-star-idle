import { describe, it, expect } from "vitest";
import { createRng } from "../src/engine/rng";
import { filterItem, DEFAULT_FILTER, sellFromInventory, type EconomyState } from "../src/engine/loot";
import { GEAR } from "../src/engine/content";
import { generateCommonWeapon, rollEnemyDropPipeline } from "../src/engine/drop-gen";
import { itemSellValue, type Item, type Tool } from "../src/engine/items";

describe("drop generation (seeded)", () => {
  it("reproduces the same enemy pipeline decisions for the same seed", () => {
    const context = { difficulty: "Normal" as const, sectionId: "Viridia" as const, areaNorm: 0 };
    const runA = createRng("run", 1);
    const runB = createRng("run", 1);
    const seqA = Array.from({ length: 30 }, () => rollEnemyDropPipeline("BOOMA", context, runA));
    const seqB = Array.from({ length: 30 }, () => rollEnemyDropPipeline("BOOMA", context, runB));
    expect(seqA).toEqual(seqB);
  });

  it("generated common weapons are authentic item-table items", () => {
    const context = { difficulty: "Hard" as const, sectionId: "Viridia" as const, areaNorm: 2 };
    const rng = createRng("weapons", 5);
    const item = generateCommonWeapon(context, rng, () => "x")!;
    expect(item.code).toMatch(/^00/);
    expect(item.defId).toBe(item.code);
  });
});

describe("loot filter", () => {
  const rare: Item = { ...GEAR.photonEdge, id: "r1" } as Item;
  const junk: Item = { ...GEAR.handBlade, id: "j1" } as Item;

  it("keeps rares regardless of value bar", () => {
    expect(filterItem(rare, { autoSellBelow: 100000, alwaysKeep: ["rare"] })).toBe("keep");
  });

  it("auto-sells low-value gear below the bar", () => {
    expect(filterItem(junk, DEFAULT_FILTER)).toBe("sell"); // handBlade sells well below the bar
  });

  it("keeps gear at or above the bar", () => {
    const valuable = { ...GEAR.greatBlade, id: "g", sellValue: DEFAULT_FILTER.autoSellBelow } as Item;
    expect(filterItem(valuable, DEFAULT_FILTER)).toBe("keep");
  });

  it("filters inert tool items by rarity and sell value", () => {
    const monofluid: Tool = {
      kind: "tool",
      id: "tool-1",
      defId: "030100",
      code: "030100",
      name: "Monofluid",
      rarity: "common",
      stars: 0,
      sellValue: 12,
    };
    expect(itemSellValue(monofluid)).toBe(12);
    expect(filterItem(monofluid, DEFAULT_FILTER)).toBe("sell");
    expect(filterItem({ ...monofluid, rarity: "rare" }, DEFAULT_FILTER)).toBe("keep");
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
