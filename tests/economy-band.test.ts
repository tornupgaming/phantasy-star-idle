import { describe, it, expect } from "vitest";
import { emptyEquipment, equip, type Character } from "../src/engine/character";
import { GEAR, startingCharacter } from "../src/engine/content";
import { DEFAULT_FILTER, type GearTemplate } from "../src/engine/loot";
import { simulateRun } from "../src/engine/run";
import type { Weapon, Frame, Barrier } from "../src/engine/items";

/**
 * Economy distribution sanity (authentic-drop-generation 7.2).
 *
 * Meseta income per run — drop meseta plus auto-sell under the default filter —
 * must stay inside the band the economy was tuned against (consumable prices,
 * shop prices, starter meseta). The runs are fully seeded, so drift outside the
 * band means the drop tables, the sell values, the filter default, or the
 * meseta multipliers changed and the economy needs re-tuning, not that the
 * test is flaky.
 */

function char(level: number, weapon: GearTemplate): Character {
  const c = startingCharacter();
  c.level = level;
  c.sectionId = "Viridia";
  c.equipment = emptyEquipment();
  equip(c, { ...weapon, id: "w" } as Weapon);
  equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
  equip(c, { ...GEAR.aegisBarrier, id: "b" } as Barrier);
  return c;
}

function averageIncome(areaId: string, level: number, weapon: GearTemplate): { meseta: number; kept: number } {
  const runs = 25;
  let meseta = 0;
  let kept = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const r = simulateRun({
      runId: `band-${seed}`,
      seed,
      areaId,
      difficultyId: "normal",
      character: char(level, weapon),
      supply: { monomate: 90, "moon-atomizer": 6 },
      filter: DEFAULT_FILTER,
      pattern: ["normal", "normal", "heavy"],
    });
    meseta += r.loot.meseta;
    kept += r.loot.items.length;
  }
  return { meseta: meseta / runs, kept: kept / runs };
}

// Bands retuned for authentic pricing (authentic-shop-inventory 4.4 balance
// sweep): sell = price_for_item >> 3 raised sell-side income, and the default
// filter bar moved 300 → 550. Measured means: forest/8 ≈ 759, mines/30 ≈ 15.1k;
// bands are ±~30%. At these rates tier-appropriate shop gear costs well under
// 2 runs and the 5000m grinder ~6.5 early-game runs tapering to <1 mid-game.
describe("meseta income stays within the tuned band", () => {
  it("forest normal (early game): everything auto-sells, modest income", () => {
    const { meseta, kept } = averageIncome("forest", 8, GEAR.ironSaber);
    expect(meseta).toBeGreaterThanOrEqual(530);
    expect(meseta).toBeLessThanOrEqual(990);
    // The default bar sells the entire early-game drop flood.
    expect(kept).toBeLessThan(1);
  });

  it("mines normal (mid game): income scales up, kept items stay manageable", () => {
    const { meseta, kept } = averageIncome("mines", 30, GEAR.photonEdge);
    expect(meseta).toBeGreaterThanOrEqual(10500);
    expect(meseta).toBeLessThanOrEqual(19500);
    // Upgrades are kept, but the filter default prevents inventory flooding.
    expect(kept).toBeLessThan(15);
  });
});
