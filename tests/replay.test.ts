import { describe, it, expect } from "vitest";
import { emptyEquipment, equip, type Character } from "../src/engine/character";
import { GEAR, startingCharacter } from "../src/engine/content";
import { DEFAULT_FILTER, type LootFilter } from "../src/engine/loot";
import { simulateRun, type RunInput } from "../src/engine/run";
import type { SectionId } from "../src/engine/classes";
import type { Weapon, Frame, Barrier } from "../src/engine/items";

function geared(): Character {
  const c = startingCharacter();
  c.equipment = emptyEquipment();
  equip(c, { ...GEAR.ironSaber, id: "w" } as Weapon);
  equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
  equip(c, { ...GEAR.woodShield, id: "b" } as Barrier);
  return c;
}

/** A level-30 farmer that clears mines, exercising the full generator surface. */
function farmer(sectionId: SectionId): Character {
  const c = startingCharacter();
  c.level = 30;
  c.sectionId = sectionId;
  c.equipment = emptyEquipment();
  equip(c, { ...GEAR.photonEdge, id: "w" } as Weapon);
  equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
  equip(c, { ...GEAR.aegisBarrier, id: "b" } as Barrier);
  return c;
}

const KEEP_ALL: LootFilter = { autoSellBelow: 0, alwaysKeep: [] };

const input = (seed: number): RunInput => ({
  runId: "replay-run",
  seed,
  areaId: "forest",
  difficultyId: "normal",
  character: geared(),
  supply: { monomate: 5 },
  filter: DEFAULT_FILTER,
  pattern: ["normal", "normal", "heavy"],
});

describe("deterministic replay (task 7.5)", () => {
  it("re-simulating a saved run reproduces the identical log + loot", () => {
    const a = simulateRun(input(123));
    const b = simulateRun(input(123));
    expect(b.events).toEqual(a.events);
    expect(b.loot).toEqual(a.loot);
    expect(b.xpGained).toEqual(a.xpGained); // XP is part of the determinism contract
    expect(b.outcome).toBe(a.outcome);
    expect(b.endTime).toBe(a.endTime);
    expect(b.consumablesUsed).toEqual(a.consumablesUsed);
  });

  it("different seeds produce different timelines", () => {
    const a = simulateRun(input(1));
    const b = simulateRun(input(2));
    expect(b.events).not.toEqual(a.events);
  });

  it("minted loot item ids are stable across replays", () => {
    const a = simulateRun(input(7));
    const b = simulateRun(input(7));
    expect(b.loot.items.map((i) => i.id)).toEqual(a.loot.items.map((i) => i.id));
  });
});

describe("authentic drop path end-to-end (drop-generation spec)", () => {
  const mineRun = (seed: number, sectionId: SectionId): RunInput => ({
    runId: "drop-replay",
    seed,
    areaId: "mines",
    difficultyId: "normal",
    character: farmer(sectionId),
    supply: { monomate: 60, "moon-atomizer": 5 },
    filter: KEEP_ALL,
    pattern: ["normal", "normal", "heavy"],
  });

  it("replay reproduces every generated drop, including variance fields", () => {
    const a = simulateRun(mineRun(7, "Viridia"));
    const b = simulateRun(mineRun(7, "Viridia"));
    expect(a.loot.items.length).toBeGreaterThan(0);
    // Deep equality covers the generator's variance: kind, code, grind,
    // attribute bonuses, special, slots, stars, and dfp/evp rolls.
    expect(b.loot.items).toEqual(a.loot.items);
    expect(b.loot.meseta).toBe(a.loot.meseta);
    expect(b.loot.grinders).toBe(a.loot.grinders);
    expect(b.loot.consumables).toEqual(a.loot.consumables);
  });

  it("every generated item is authentic — carries its PSO code and star count", () => {
    const r = simulateRun(mineRun(7, "Viridia"));
    for (const item of r.loot.items) {
      expect(item.code).toMatch(/^[0-9A-F]{6}$/);
      expect(item.stars).toBeGreaterThanOrEqual(0);
    }
  });

  it("the character's section ID selects the drop tables", () => {
    const viridia = simulateRun(mineRun(7, "Viridia"));
    const skyly = simulateRun(mineRun(7, "Skyly"));
    const sig = (r: typeof viridia) =>
      r.loot.items.map((i) => ({ ...i, id: "" })); // ignore mint order ids
    expect(sig(skyly)).not.toEqual(sig(viridia));
  });
});
