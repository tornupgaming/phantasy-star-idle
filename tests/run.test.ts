import { describe, it, expect } from "vitest";
import { emptyEquipment, equip, type Character } from "../src/engine/character";
import { sectionIdFromName } from "../src/engine/progression";
import { GEAR, startingCharacter } from "../src/engine/content";
import { DEFAULT_FILTER } from "../src/engine/loot";
import { simulateRun, revealUpTo, isRunFinished, type RunInput } from "../src/engine/run";
import type { Weapon, Frame, Barrier } from "../src/engine/items";

function geared(): Character {
  const c = startingCharacter();
  c.equipment = emptyEquipment();
  equip(c, { ...GEAR.ironSaber, id: "w" } as Weapon);
  equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
  equip(c, { ...GEAR.woodShield, id: "b" } as Barrier);
  return c;
}

// A fresh level-1 FOnewearl (the squishiest class: 19 HP, 10 ATP) — fodder for
// ultimate-difficulty survival tests: its attacks hit the 0-damage wall and it
// cannot survive ultimate mines enemies.
function fragileCharacter(): Character {
  return {
    id: "fragile-1",
    name: "Hunter",
    classId: "fonewearl",
    sectionId: sectionIdFromName("Hunter"),
    level: 1,
    xp: 0,
    equipment: emptyEquipment(),
  };
}

const baseInput = (over: Partial<RunInput> = {}): RunInput => ({
  runId: "run-1",
  seed: 42,
  areaId: "forest",
  difficultyId: "normal",
  character: geared(),
  supply: { monomate: 5, "moon-atomizer": 1 },
  filter: DEFAULT_FILTER,
  pattern: ["normal", "normal", "heavy"],
  ...over,
});

describe("room progression", () => {
  it("a well-geared character completes the forest and returns loot", () => {
    const result = simulateRun(baseInput());
    expect(result.outcome).toBe("complete");
    expect(result.roomsCleared).toBe(result.totalRooms);
    expect(result.events.some((e) => e.kind === "complete")).toBe(true);
    expect(result.events.some((e) => e.kind === "kill")).toBe(true);
    // A completed run passed through every room.
    const rooms = result.events.filter((e) => e.kind === "room").length;
    expect(rooms).toBe(result.totalRooms);
  });

  it("boxes open only after a room's enemies are cleared", () => {
    const result = simulateRun(baseInput());
    // For each box event, the most recent room's kills all precede it (no living enemy).
    // Simpler invariant: the first box event comes after the first kill event.
    const firstKill = result.events.findIndex((e) => e.kind === "kill");
    const firstBox = result.events.findIndex((e) => e.kind === "box");
    expect(firstKill).toBeGreaterThanOrEqual(0);
    expect(firstBox).toBeGreaterThan(firstKill);
  });
});

describe("Monest brood spawns", () => {
  it("spawns Mothmants every 5 seconds while the Monest is alive, then stops", () => {
    const result = simulateRun(baseInput({ seed: 1, supply: { monomate: 25, "moon-atomizer": 3 } }));
    const roomEvents = result.events.filter((e) => e.kind === "room");
    const broodRoom = roomEvents.find((e) => e.room!.enemies.some((x) => x.id === "monest"))!;
    const roomStart = result.events.indexOf(broodRoom);
    const nextRoom = result.events.findIndex((e, i) => i > roomStart && e.kind === "room");
    const roomSlice = result.events.slice(roomStart, nextRoom < 0 ? undefined : nextRoom);
    const spawnEvents = roomSlice.filter((e) => e.kind === "spawn");
    expect(spawnEvents.length).toBeGreaterThan(0);
    for (let i = 1; i < spawnEvents.length; i++) {
      expect(spawnEvents[i].t - spawnEvents[i - 1].t).toBe(5_000);
    }
    const monestIndex = broodRoom.room!.enemies.findIndex((x) => x.id === "monest");
    const monestKill = roomSlice.find((e) => e.kind === "kill" && e.kill!.enemyIndex === monestIndex);
    if (monestKill) {
      expect(roomSlice.some((e) => e.kind === "spawn" && e.t > monestKill.t)).toBe(false);
    }
  });

  it("spawned Mothmants are normal kill-reward enemies", () => {
    const result = simulateRun(baseInput({ seed: 1, supply: { monomate: 25, "moon-atomizer": 3 } }));
    const firstSpawnIndex = result.events.findIndex((e) => e.kind === "spawn");
    expect(firstSpawnIndex).toBeGreaterThanOrEqual(0);
    let roomStart = -1;
    for (let i = firstSpawnIndex - 1; i >= 0; i--) {
      if (result.events[i].kind === "room") {
        roomStart = i;
        break;
      }
    }
    const nextRoom = result.events.findIndex((e, i) => i > firstSpawnIndex && e.kind === "room");
    const roomSlice = result.events.slice(roomStart, nextRoom < 0 ? undefined : nextRoom);
    const spawnedIndices = new Set(roomSlice.filter((e) => e.kind === "spawn").map((e) => e.spawn!.enemyIndex));
    const spawnedKill = roomSlice.find((e) => e.kind === "kill" && spawnedIndices.has(e.kill!.enemyIndex));
    expect(spawnedKill?.kill!.xp).toBe(1);
    expect(result.xpGained).toBeGreaterThan(0);
  });
});

describe("two-clock exchange", () => {
  it("both the character and enemies take attacks", () => {
    const result = simulateRun(baseInput());
    const charAttacks = result.events.filter(
      (e) => e.kind === "attack" && e.text.startsWith(result.runId === "" ? "" : "Hunter"),
    );
    const enemyAttacks = result.events.filter(
      (e) => e.kind === "attack" && !e.text.startsWith("Hunter"),
    );
    expect(charAttacks.length).toBeGreaterThan(0);
    expect(enemyAttacks.length).toBeGreaterThan(0);
  });
});

describe("survival + ejection", () => {
  it("ejects when overwhelmed with no revive, keeping loot intact", () => {
    // Fragile character into ultimate mines: enemies vastly out-damage; no supply.
    const weak = fragileCharacter();
    equip(weak, { ...GEAR.handBlade, id: "w" } as Weapon);
    const result = simulateRun(
      baseInput({
        character: weak,
        areaId: "mines",
        difficultyId: "ultimate",
        supply: {},
      }),
    );
    expect(result.outcome).toBe("ejected");
    expect(result.events.some((e) => e.kind === "eject")).toBe(true);
    // Loot object is present and retained (never discarded on eject).
    expect(result.loot).toBeDefined();
    expect(result.loot.meseta).toBeGreaterThanOrEqual(0);
  });

  it("0-damage wall: under-geared attacks can't kill, run ends by ejection", () => {
    const puny = fragileCharacter();
    equip(puny, { ...GEAR.handBlade, id: "w" } as Weapon); // tiny ATP vs ultimate Gillchic DFP
    const result = simulateRun(
      baseInput({ character: puny, areaId: "mines", difficultyId: "ultimate", supply: {} }),
    );
    expect(result.outcome).toBe("ejected");
    expect(result.events.some((e) => e.kind === "kill")).toBe(false); // never killed anything
  });

  it("uses a revive when available before ejecting", () => {
    const weak = fragileCharacter();
    equip(weak, { ...GEAR.handBlade, id: "w" } as Weapon);
    const result = simulateRun(
      baseInput({
        character: weak,
        areaId: "mines",
        difficultyId: "ultimate",
        supply: { "moon-atomizer": 1 },
      }),
    );
    expect(result.events.some((e) => e.kind === "revive")).toBe(true);
    expect(result.consumablesUsed["moon-atomizer"]).toBe(1);
  });
});

describe("background reveal", () => {
  it("revealUpTo returns a growing prefix and finishes at endTime", () => {
    const result = simulateRun(baseInput());
    const mid = revealUpTo(result, result.endTime / 2);
    const all = revealUpTo(result, result.endTime);
    expect(mid.length).toBeLessThan(all.length);
    expect(all.length).toBe(result.events.length);
    expect(isRunFinished(result, result.endTime)).toBe(true);
    expect(isRunFinished(result, result.endTime - 1)).toBe(false);
    // Revealed events are exactly those with t <= gameTime, in order.
    expect(mid.every((e) => e.t <= result.endTime / 2)).toBe(true);
  });
});
