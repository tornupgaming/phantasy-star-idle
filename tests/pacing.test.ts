import { describe, it, expect } from "vitest";
import { emptyEquipment, equip, type Character } from "../src/engine/character";
import { GEAR, startingCharacter } from "../src/engine/content";
import { DEFAULT_FILTER } from "../src/engine/loot";
import { simulateRun, type RunInput, type RunEvent } from "../src/engine/run";
import { nextComboDelay, engageDelayMs, COMBO_RECOVERY_MS, FIST_KIND } from "../src/engine/pacing";
import { attackStepMs } from "../src/engine/data/frame-data";
import type { AttackType } from "../src/engine/combat";
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
  runId: "pacing-run",
  seed,
  areaId: "forest",
  difficultyId: "normal",
  character: geared(),
  // Generous supply: this file tests swing rhythm, not survival; the final
  // sanity check wants a full clear of the authentic ~30-room layout.
  supply: { monomate: 40, "moon-atomizer": 3 },
  filter: DEFAULT_FILTER,
  pattern: ["normal", "normal", "heavy"],
});

// The geared character: HUmar (male rig), Iron Saber (curated → saber kind 1),
// no speed units. Frame-data expectations at boost 0.
const SABER = 1;
const ms = (frames: number) => Math.round((frames * 1000) / 30);
const stepMs = (type: AttackType, step: number, isFinal: boolean) =>
  attackStepMs("male", SABER, type, step, isFinal, 0);

describe("combo-burst delay (unit)", () => {
  it("chained steps bill their Combo duration (male saber @0%: 16f, 14f)", () => {
    expect(nextComboDelay("male", SABER, "normal", 0, false, 0)).toBe(ms(16));
    expect(nextComboDelay("male", SABER, "normal", 1, false, 0)).toBe(ms(14));
  });

  it("the third step bills its Full duration plus the repositioning pause", () => {
    expect(nextComboDelay("male", SABER, "normal", 2, false, 0)).toBe(ms(40) + COMBO_RECOVERY_MS);
    expect(nextComboDelay("male", SABER, "heavy", 2, false, 0)).toBe(ms(41) + COMBO_RECOVERY_MS);
  });

  it("a kill mid-burst bills the step's Full duration plus the pause (repositioning)", () => {
    expect(nextComboDelay("male", SABER, "normal", 0, true, 0)).toBe(ms(32) + COMBO_RECOVERY_MS);
    expect(nextComboDelay("male", SABER, "normal", 1, true, 0)).toBe(ms(28) + COMBO_RECOVERY_MS);
  });

  it("Heavy chained steps cost more than Normal (frame data, not a modifier)", () => {
    expect(nextComboDelay("male", SABER, "heavy", 0, false, 0)).toBeGreaterThan(
      nextComboDelay("male", SABER, "normal", 0, false, 0),
    );
  });

  it("a speed boost shortens every delay", () => {
    for (const [step, reset] of [[0, false], [1, false], [2, false], [0, true]] as const) {
      expect(nextComboDelay("male", SABER, "normal", step, reset, 40)).toBeLessThan(
        nextComboDelay("male", SABER, "normal", step, reset, 0),
      );
    }
  });

  it("barehanded uses the fist animations", () => {
    expect(nextComboDelay("male", null, "normal", 0, false, 0)).toBe(
      attackStepMs("male", FIST_KIND, "normal", 0, false, 0),
    );
  });

  it("engage delay = repositioning pause + first chained step", () => {
    expect(engageDelayMs("male", SABER, "normal", 0)).toBe(COMBO_RECOVERY_MS + ms(16));
  });
});

/** Character attack events grouped per room, in order. */
function charAttacksByRoom(events: RunEvent[]): RunEvent[][] {
  const rooms: RunEvent[][] = [];
  for (const e of events) {
    if (e.kind === "room") rooms.push([]);
    if (e.kind === "attack" && e.attack?.actor === "char") rooms[rooms.length - 1].push(e);
  }
  return rooms;
}

// Every possible swing-to-swing gap under the NNH pattern (combo step ==
// pattern position): chained N1/N2, and burst-enders (kill or third step)
// billing Full + recovery for whichever type/step just swung.
const CHAINED_GAPS = [stepMs("normal", 0, false), stepMs("normal", 1, false)];
const BURST_END_GAPS = [
  stepMs("normal", 0, true) + COMBO_RECOVERY_MS,
  stepMs("normal", 1, true) + COMBO_RECOVERY_MS,
  stepMs("heavy", 2, true) + COMBO_RECOVERY_MS,
];

describe("combo-burst rhythm (simulated run)", () => {
  const result = simulateRun(input(123));
  const events = result.events;
  const rooms = charAttacksByRoom(events);

  it("every gap between character swings is a chained step or a burst end", () => {
    for (const attacks of rooms) {
      for (let i = 1; i < attacks.length; i++) {
        const gap = attacks[i].t - attacks[i - 1].t;
        expect([...CHAINED_GAPS, ...BURST_END_GAPS]).toContain(gap);
      }
    }
  });

  it("bursts never exceed three swings (at most two chained gaps in a row)", () => {
    for (const attacks of rooms) {
      let consecutiveChained = 0;
      for (let i = 1; i < attacks.length; i++) {
        if (CHAINED_GAPS.includes(attacks[i].t - attacks[i - 1].t)) {
          consecutiveChained++;
          expect(consecutiveChained).toBeLessThanOrEqual(2);
        } else {
          consecutiveChained = 0;
        }
      }
    }
  });

  it("a kill is followed by a Full duration + recovery before the next swing", () => {
    for (let i = 0; i < events.length; i++) {
      if (events[i].kind !== "kill") continue;
      // The next character attack after this kill (same room) starts a new burst.
      for (let j = i + 1; j < events.length; j++) {
        if (events[j].kind === "room") break;
        if (events[j].kind === "attack" && events[j].attack?.actor === "char") {
          const killingSwing = events
            .slice(0, i)
            .reverse()
            .find((e) => e.kind === "attack" && e.attack?.actor === "char")!;
          expect(BURST_END_GAPS).toContain(events[j].t - killingSwing.t);
          break;
        }
      }
    }
  });

  it("the first swing of a room lands one approach (recovery + step) after entry", () => {
    const engage = engageDelayMs("male", SABER, "normal", 0);
    const roomEvents = events.filter((e) => e.kind === "room");
    for (const room of roomEvents) {
      const firstAttack = events.find(
        (e) => e.t > room.t && e.kind === "attack" && e.attack?.actor === "char",
      );
      if (firstAttack) expect(firstAttack.t - room.t).toBeGreaterThanOrEqual(engage);
    }
  });

  it("misses keep burst timing", () => {
    // Gaps after misses obey the same chained/burst-end grid as hits: already
    // covered by the exhaustive gap check above; assert a miss actually occurred
    // somewhere across seeds so the property isn't vacuous.
    const anyMiss = [1, 2, 3, 123].some((s) =>
      simulateRun(input(s)).events.some((e) => e.attack?.actor === "char" && !e.attack.hit),
    );
    expect(anyMiss).toBe(true);
  });

  it("a Heavenly/Battle-style boost yields a strictly faster clear", () => {
    const slow = simulateRun(input(123));
    const boosted = input(123);
    boosted.character.equipment.units = [
      {
        id: "u1", defId: "heavenly-battle", name: "Heavenly/Battle", kind: "unit",
        rarity: "rare", sellValue: 0, bonus: {}, attackSpeedBoost: 40,
      },
    ];
    const fast = simulateRun(boosted);
    expect(fast.endTime).toBeLessThan(slow.endTime);
  });

  it("total rooms sanity: run still completes the area", () => {
    expect(result.outcome).toBe("complete");
    expect(result.roomsCleared).toBe(result.totalRooms);
    expect(result.roomsCleared).toBe(result.roomPlan.length);
  });
});
