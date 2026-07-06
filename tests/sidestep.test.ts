/**
 * weapon-avoidance spec: the sidestep pre-roll on incoming enemy attacks —
 * sidesteps never change HP, the rate tracks the equipped weapon kind's
 * avoidance, character attacks are unaffected, and replays are deterministic.
 */

import { describe, it, expect } from "vitest";
import { emptyEquipment, equip, type Character } from "../src/engine/character";
import { GEAR, startingCharacter } from "../src/engine/content";
import { DEFAULT_FILTER } from "../src/engine/loot";
import { simulateRun, type RunInput, type RunEvent } from "../src/engine/run";
import { AVOIDANCE_PCT } from "../src/engine/data/avoidance";
import type { Weapon, Frame, Barrier } from "../src/engine/items";

function geared(weapon: keyof typeof GEAR | null): Character {
  const c = startingCharacter();
  c.equipment = emptyEquipment();
  if (weapon) equip(c, { ...GEAR[weapon], id: "w" } as Weapon);
  equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
  equip(c, { ...GEAR.woodShield, id: "b" } as Barrier);
  return c;
}

const input = (seed: number, weapon: keyof typeof GEAR | null): RunInput => ({
  runId: "sidestep-run",
  seed,
  areaId: "forest",
  difficultyId: "normal",
  character: geared(weapon),
  supply: { monomate: 25, dimate: 10, "moon-atomizer": 3 },
  filter: DEFAULT_FILTER,
  pattern: ["normal", "normal", "heavy"],
});

/** Sidesteps and enemy attack events across several seeds (one weapon kind). */
function enemySwings(weapon: keyof typeof GEAR | null, seeds: number[]) {
  let sidesteps = 0;
  let attacks = 0;
  const events: RunEvent[] = [];
  for (const seed of seeds) {
    const result = simulateRun(input(seed, weapon));
    for (const e of result.events) {
      if (e.kind === "sidestep") sidesteps++;
      else if (e.kind === "attack" && e.attack!.actor !== "char") attacks++;
      events.push(e);
    }
  }
  return { sidesteps, attacks, events };
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe("sidestep pre-roll (weapon-avoidance)", () => {
  it("sidestep events carry the attacker index and change no HP", () => {
    const { sidesteps, events } = enemySwings("ironSaber", SEEDS);
    expect(sidesteps).toBeGreaterThan(0);
    let lastHp: number | null = null;
    for (const e of events) {
      if (e.kind === "sidestep") {
        expect(typeof e.sidestep!.actor).toBe("number");
        expect(e.text).toMatch(/you sidestep\.$/);
        expect(e.attack).toBeUndefined();
        expect(e.hp).toBeUndefined();
      }
      // Character HP tracked via enemy attack payloads is never perturbed by a
      // sidestep: HP only moves through attack/heal/revive events.
      if (e.kind === "attack" && e.attack!.actor !== "char" && e.attack!.hit) {
        lastHp = e.attack!.hpAfter;
      }
      if ((e.kind === "heal" || e.kind === "revive") && lastHp !== null) {
        expect(e.hp!.hpAfter).toBeGreaterThan(0);
      }
    }
  });

  it("sidestep rate tracks the melee avoidance value", () => {
    const { sidesteps, attacks } = enemySwings("ironSaber", SEEDS);
    const rate = sidesteps / (sidesteps + attacks);
    const expected = AVOIDANCE_PCT.saber / 100;
    expect(rate).toBeGreaterThan(expected - 0.08);
    expect(rate).toBeLessThan(expected + 0.08);
  });

  it("a rifle sidesteps proportionally more than a saber", () => {
    const saber = enemySwings("ironSaber", SEEDS);
    const rifle = enemySwings("scoutRifle", SEEDS);
    const saberRate = saber.sidesteps / (saber.sidesteps + saber.attacks);
    const rifleRate = rifle.sidesteps / (rifle.sidesteps + rifle.attacks);
    expect(rifleRate).toBeGreaterThan(saberRate);
    const expected = AVOIDANCE_PCT.rifle / 100;
    expect(rifleRate).toBeGreaterThan(expected - 0.08);
    expect(rifleRate).toBeLessThan(expected + 0.08);
  });

  it("barehanded runs use the fist row and still sidestep", () => {
    const { sidesteps, attacks } = enemySwings(null, SEEDS);
    expect(sidesteps).toBeGreaterThan(0);
    const rate = sidesteps / (sidesteps + attacks);
    const expected = AVOIDANCE_PCT.fist / 100;
    expect(rate).toBeGreaterThan(expected - 0.1);
    expect(rate).toBeLessThan(expected + 0.1);
  });

  it("character attacks never emit sidestep events", () => {
    const { events } = enemySwings("ironSaber", SEEDS);
    for (const e of events) {
      if (e.kind !== "sidestep") continue;
      // The payload's actor is always an enemy roster index, never the character.
      expect(e.sidestep!.actor).toBeGreaterThanOrEqual(0);
    }
    // Character attack events are untouched in shape.
    const charAttacks = events.filter((e) => e.kind === "attack" && e.attack!.actor === "char");
    expect(charAttacks.length).toBeGreaterThan(0);
  });

  it("same (runId, seed) reproduces the identical sidestep pattern", () => {
    const a = simulateRun(input(42, "ironSaber"));
    const b = simulateRun(input(42, "ironSaber"));
    expect(b.events).toEqual(a.events);
    expect(a.events.some((e) => e.kind === "sidestep")).toBe(true);
  });
});
