/**
 * Pan Arms split behavior (see CONTEXT.md: Pan Arms, Split, Hidoom / Migium).
 *
 * Only the fused Pan Arms spawns (authentic map data pre-allocates the two
 * halves, so generation collapses each HIDOOM/MIGIUM/PAN_ARMS trio); after
 * completing its second attack it splits into Hidoom and Migium at full HP,
 * with no kill credit, XP, or drop for the fused form.
 */

import { describe, expect, it } from "vitest";
import { emptyEquipment, equip, type Character } from "../src/engine/character";
import { GEAR, getArea, startingCharacter } from "../src/engine/content";
import { DEFAULT_FILTER } from "../src/engine/loot";
import { createRng } from "../src/engine/rng";
import { simulateRun, type RunEvent, type RunInput } from "../src/engine/run";
import { generateStage } from "../src/engine/stage-gen";
import { sceneAt } from "../src/ui/scene";
import type { Weapon, Frame, Barrier } from "../src/engine/items";

function caveStage(seed: number) {
  return generateStage(getArea("cave-3"), createRng("pan-arms-test", seed));
}

function geared(): Character {
  const c = startingCharacter();
  c.level = 60; // strong enough to clear Cave 3 rooms on normal
  c.equipment = emptyEquipment();
  equip(c, { ...GEAR.ironSaber, id: "w" } as Weapon);
  equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
  equip(c, { ...GEAR.woodShield, id: "b" } as Barrier);
  return c;
}

const input = (seed: number): RunInput => ({
  runId: "pan-arms-run",
  seed,
  areaId: "cave-3",
  difficultyId: "normal",
  character: geared(),
  supply: { monomate: 50, "moon-atomizer": 5 },
  filter: DEFAULT_FILTER,
  pattern: ["normal", "normal", "heavy"],
});

/** Events of the room containing index `i` of `events` (room-scoped indices). */
function roomSpan(events: RunEvent[], i: number): RunEvent[] {
  let start = i;
  while (start > 0 && events[start].kind !== "room") start--;
  let end = i + 1;
  while (end < events.length && events[end].kind !== "room") end++;
  return events.slice(start, end);
}

describe("stage generation collapses Pan Arms trios", () => {
  it("never rosters Hidoom or Migium at generation time", () => {
    let sawPanArms = false;
    for (let seed = 1; seed <= 50; seed++) {
      for (const room of caveStage(seed).rooms) {
        expect(room.enemies).not.toContain("hidoom");
        expect(room.enemies).not.toContain("migium");
        if (room.enemies.includes("pan-arms")) sawPanArms = true;
      }
    }
    expect(sawPanArms).toBe(true);
  });

  it("counts each Pan Arms as 2 slots against the room cap", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const room of caveStage(seed).rooms) {
        const pan = room.enemies.filter((id) => id === "pan-arms").length;
        expect(room.enemies.length + pan).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe("Pan Arms splits mid-fight", () => {
  // Find a run whose log contains a split (Cave 3 rolls Pan Arms waves often).
  let events: RunEvent[] = [];
  let splitAt = -1;
  for (let seed = 1; seed <= 40 && splitAt < 0; seed++) {
    events = simulateRun(input(seed)).events;
    splitAt = events.findIndex((e) => e.kind === "split");
  }
  const split = splitAt >= 0 ? events[splitAt].split! : undefined;
  const span = splitAt >= 0 ? roomSpan(events, splitAt) : [];

  it("a split occurs within the sampled seeds", () => {
    expect(split).toBeDefined();
  });

  it("fires after the fused form completes exactly two attacks", () => {
    const before = roomSpan(events.slice(0, splitAt + 1), splitAt);
    const fusedActs = before.filter(
      (e) =>
        (e.kind === "attack" && e.attack?.actor === split!.enemyIndex) ||
        (e.kind === "sidestep" && e.sidestep?.actor === split!.enemyIndex),
    );
    expect(fusedActs.length).toBe(2);
  });

  it("splits the rostered Pan Arms into Hidoom and Migium at full HP", () => {
    const room = span.find((e) => e.kind === "room")!.room!;
    expect(room.enemies[split!.enemyIndex].id).toBe("pan-arms");
    expect(split!.halves.map((h) => h.id)).toEqual(["hidoom", "migium"]);
    for (const h of split!.halves) {
      expect(h.enemyIndex).toBeGreaterThanOrEqual(room.enemies.length);
      expect(h.maxHp).toBeGreaterThan(0);
    }
  });

  it("grants no kill credit for the fused form; the halves die like any enemy", () => {
    const kills = span.filter((e) => e.kind === "kill").map((e) => e.kill!);
    expect(kills.some((k) => k.enemyIndex === split!.enemyIndex)).toBe(false);
    for (const h of split!.halves) {
      const kill = kills.find((k) => k.enemyIndex === h.enemyIndex);
      expect(kill).toBeDefined();
      expect(kill!.xp).toBeGreaterThan(0);
    }
  });

  it("both halves attack after the split (no trickle-aggro queueing)", () => {
    const after = span.slice(span.indexOf(events[splitAt]) + 1);
    for (const h of split!.halves) {
      const acted = after.some(
        (e) =>
          (e.kind === "attack" && e.attack?.actor === h.enemyIndex) ||
          (e.kind === "sidestep" && e.sidestep?.actor === h.enemyIndex) ||
          (e.kind === "kill" && e.kill?.enemyIndex === h.enemyIndex),
      );
      expect(acted).toBe(true);
    }
  });

  it("the scene fold removes the fused form and reveals both halves", () => {
    const upToSplit = events.slice(0, splitAt + 1);
    const scene = sceneAt(upToSplit, 999, {});
    const fused = scene.enemies[split!.enemyIndex];
    expect(fused.dead).toBe(true);
    expect(fused.split).toBe(true);
    for (const h of split!.halves) {
      expect(scene.enemies[h.enemyIndex]).toMatchObject({
        id: h.id,
        hp: h.maxHp,
        dead: false,
      });
    }
  });
});
