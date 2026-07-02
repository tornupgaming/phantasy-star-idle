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
  runId: "events-run",
  seed,
  areaId: "forest",
  difficultyId: "normal",
  character: geared(),
  supply: { monomate: 25, "moon-atomizer": 3 },
  filter: DEFAULT_FILTER,
  pattern: ["normal", "normal", "heavy"],
});

describe("structured event payloads (battle-scene-view)", () => {
  const result = simulateRun(input(123));
  const events = result.events;

  it("room events carry the roster matching the generated stage's room plan", () => {
    const roomEvents = events.filter((e) => e.kind === "room");
    expect(roomEvents.length).toBeGreaterThan(0);
    roomEvents.forEach((e, i) => {
      expect(e.room).toBeDefined();
      expect(e.room!.roomIndex).toBe(i);
      expect(e.room!.totalRooms).toBe(result.roomPlan.length);
      expect(e.room!.boxes).toBe(result.roomPlan[i].boxes);
      expect(e.room!.enemies.length).toBe(result.roomPlan[i].enemies);
      for (const enemy of e.room!.enemies) {
        expect(enemy.name.length).toBeGreaterThan(0);
        expect(enemy.maxHp).toBeGreaterThan(0);
      }
    });
  });

  it("every attack event carries a payload consistent with its text", () => {
    const attacks = events.filter((e) => e.kind === "attack");
    expect(attacks.length).toBeGreaterThan(0);
    for (const e of attacks) {
      const a = e.attack!;
      expect(a).toBeDefined();
      if (!a.hit) {
        expect(e.text).toMatch(/miss\.$/);
        expect(a.damage).toBe(0);
      } else {
        // The HP printed in the prose matches the structured hpAfter.
        const m = e.text.match(/HP (\d+)\//);
        expect(m).not.toBeNull();
        expect(Number(m![1])).toBe(a.hpAfter);
        expect(e.text).toContain(`${a.damage} dmg`);
        expect(/CRIT/.test(e.text)).toBe(a.crit);
      }
      if (a.actor === "char") expect(a.targetIndex).not.toBeNull();
      else expect(typeof a.actor).toBe("number");
    }
  });

  it("kill events identify the enemy whose HP just reached 0", () => {
    const kills = events.filter((e) => e.kind === "kill");
    expect(kills.length).toBeGreaterThan(0);
    for (const k of kills) {
      expect(k.kill).toBeDefined();
      expect(k.kill!.xp).toBeGreaterThan(0);
      // The most recent character attack targeted this index and left 0 HP.
      const prior = events.filter(
        (e) => e.t <= k.t && e.kind === "attack" && e.attack?.actor === "char",
      );
      const last = prior[prior.length - 1].attack!;
      expect(last.targetIndex).toBe(k.kill!.enemyIndex);
      expect(last.hpAfter).toBe(0);
    }
  });

  it("heal and revive events carry the consumable and resulting HP", () => {
    for (const e of events) {
      if (e.kind !== "heal" && e.kind !== "revive") continue;
      expect(e.hp).toBeDefined();
      expect(e.text).toContain(e.hp!.itemId);
      expect(e.hp!.hpAfter).toBeGreaterThan(0);
    }
  });

  it("spawn events append enemies with stable roster indices", () => {
    const result = simulateRun(input(1));
    const spawnEvents = result.events.filter((e) => e.kind === "spawn");
    expect(spawnEvents.length).toBeGreaterThan(0);
    for (const e of spawnEvents) {
      expect(e.spawn).toBeDefined();
      expect(e.spawn!.id).toBe("mothmant");
      expect(e.spawn!.name).toBe("Mothmant");
      expect(e.spawn!.maxHp).toBeGreaterThan(0);
      const room = result.events
        .slice(0, result.events.indexOf(e))
        .filter((x) => x.kind === "room")
        .at(-1)!;
      const priorSpawnsInRoom = result.events
        .slice(result.events.indexOf(room), result.events.indexOf(e))
        .filter((x) => x.kind === "spawn").length;
      expect(e.spawn!.enemyIndex).toBe(room.room!.enemies.length + priorSpawnsInRoom);
    }
  });

  it("Monest brood rooms start with Mothmants around the Monest in target order", () => {
    const result = simulateRun(input(1));
    const broodRoom = result.events.find(
      (e) => e.kind === "room" && e.room!.enemies.some((x) => x.id === "monest"),
    )!;
    const ids = broodRoom.room!.enemies.map((x) => x.id);
    const monestIndex = ids.indexOf("monest");
    const initialMothmants = ids.filter((id) => id === "mothmant").length;
    expect(initialMothmants).toBeGreaterThanOrEqual(2);
    expect(initialMothmants).toBeLessThanOrEqual(5);
    expect(monestIndex).toBeGreaterThan(0);
    expect(ids.slice(0, monestIndex).every((id) => id === "mothmant")).toBe(true);
  });

  it("payloads are identical across re-simulation (determinism)", () => {
    const again = simulateRun(input(123));
    expect(again.events).toEqual(events);
  });
});
