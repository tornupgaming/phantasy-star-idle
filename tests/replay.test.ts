import { describe, it, expect } from "vitest";
import { emptyEquipment, equip, type Character } from "../src/engine/character";
import { GEAR, startingCharacter } from "../src/engine/content";
import { DEFAULT_FILTER } from "../src/engine/loot";
import { simulateRun, type RunInput } from "../src/engine/run";
import type { Weapon, Frame, Barrier } from "../src/engine/items";

function geared(): Character {
  const c = startingCharacter();
  c.equipment = emptyEquipment();
  equip(c, { ...GEAR.ironSaber, id: "w" } as Weapon);
  equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
  equip(c, { ...GEAR.woodShield, id: "b" } as Barrier);
  return c;
}

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
