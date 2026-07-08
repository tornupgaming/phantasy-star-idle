import { describe, it, expect } from "vitest";
import {
  ATTACK_PROFILES,
  DEFAULT_ATTACK_PROFILE,
  attackProfileForWeaponKind,
} from "../src/engine/data/attack-profiles";
import { WEAPON_KIND_NAMES } from "../src/engine/items";
import type { Weapon, Frame, Barrier } from "../src/engine/items";
import { emptyEquipment, equip, type Character } from "../src/engine/character";
import { GEAR, startingCharacter } from "../src/engine/content";
import { DEFAULT_FILTER } from "../src/engine/loot";
import { simulateRun, type RunInput, type RunEvent } from "../src/engine/run";
import { nextComboDelay } from "../src/engine/pacing";
import { rigForClass } from "../src/engine/classes";
import type { AttackType } from "../src/engine/combat";

const kindIndex = (name: (typeof WEAPON_KIND_NAMES)[number]) =>
  WEAPON_KIND_NAMES.indexOf(name);

function geared(weaponKind: number): Character {
  const c = startingCharacter();
  c.equipment = emptyEquipment();
  equip(c, { ...GEAR.ironSaber, id: "w", weaponKind } as Weapon);
  equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
  equip(c, { ...GEAR.woodShield, id: "b" } as Barrier);
  return c;
}

const PATTERN: AttackType[] = ["normal", "normal", "heavy"];

const input = (weaponKind: number, seed: number): RunInput => ({
  runId: "profile-run",
  seed,
  areaId: "forest",
  difficultyId: "normal",
  character: geared(weaponKind),
  supply: { monomate: 25, "moon-atomizer": 3 },
  filter: DEFAULT_FILTER,
  pattern: PATTERN,
});

/**
 * Character swings grouped by timestamp (all hits of a swing share one `t`;
 * consecutive swings never do), split at room boundaries. Each swing carries
 * whether its primary target (first target struck) died during the swing.
 */
interface Swing {
  t: number;
  room: number;
  events: RunEvent[];
  primaryIndex: number;
  primaryKilled: boolean;
  killedIndexes: number[];
}

function charSwings(events: RunEvent[]): Swing[] {
  const swings: Swing[] = [];
  let room = -1;
  for (const e of events) {
    if (e.kind === "room") {
      room++;
      continue;
    }
    const current = swings[swings.length - 1];
    if (e.kind === "kill" && current && current.t === e.t) {
      current.killedIndexes.push(e.kill!.enemyIndex);
      if (e.kill!.enemyIndex === current.primaryIndex) current.primaryKilled = true;
      continue;
    }
    if (e.kind !== "attack" || e.attack?.actor !== "char") continue;
    if (current && current.t === e.t && current.room === room) {
      current.events.push(e);
    } else {
      swings.push({
        t: e.t,
        room,
        events: [e],
        primaryIndex: e.attack.targetIndex!,
        primaryKilled: false,
        killedIndexes: [],
      });
    }
  }
  return swings;
}

/** Combo index per swing, replaying the reset rule (room entry or primary kill). */
function comboIndexes(swings: Swing[]): number[] {
  const out: number[] = [];
  let idx = 0;
  let room = -1;
  for (const s of swings) {
    if (s.room !== room) {
      room = s.room;
      idx = 0;
    }
    out.push(idx);
    idx = s.primaryKilled ? 0 : idx + 1;
  }
  return out;
}

describe("attack profile table (weapon-attack-profiles)", () => {
  it("authored multi-hit profiles match the spec", () => {
    expect(ATTACK_PROFILES.dagger).toEqual({ hitsPerStep: [2, 2, 2], maxTargets: 1 });
    expect(ATTACK_PROFILES["double-saber"]).toEqual({ hitsPerStep: [2, 1, 3], maxTargets: 1 });
    expect(ATTACK_PROFILES.mechgun).toEqual({ hitsPerStep: [3, 3, 3], maxTargets: 1 });
    expect(ATTACK_PROFILES["twin-sword"]).toEqual({ hitsPerStep: [1, 2, 2], maxTargets: 1 });
    expect(ATTACK_PROFILES.card).toEqual({ hitsPerStep: [1, 1, 3], maxTargets: 1 });
  });

  it("authored multi-target profiles are single-hit sweeps", () => {
    for (const kind of ["sword", "partisan", "slicer", "shot"] as const) {
      const p = ATTACK_PROFILES[kind]!;
      expect(p.hitsPerStep).toEqual([1, 1, 1]);
      expect(p.maxTargets).toBeGreaterThan(1);
    }
    expect(ATTACK_PROFILES.shot!.maxTargets).toBe(5);
  });

  it("unlisted kinds and barehanded resolve to the default profile", () => {
    expect(attackProfileForWeaponKind(null)).toBe(DEFAULT_ATTACK_PROFILE);
    for (const kind of ["fist", "saber", "handgun", "rifle", "cane", "claw", "katana", "launcher"] as const) {
      expect(attackProfileForWeaponKind(kindIndex(kind))).toBe(DEFAULT_ATTACK_PROFILE);
    }
    expect(attackProfileForWeaponKind(kindIndex("mechgun")).hitsPerStep).toEqual([3, 3, 3]);
    expect(() => attackProfileForWeaponKind(99)).toThrow(/unknown WeaponKind/);
  });
});

describe("multi-hit fan-out in the run loop (run-simulation)", () => {
  const result = simulateRun(input(kindIndex("mechgun"), 77));
  const swings = charSwings(result.events);

  it("each swing emits one attack event per hit, up to the step's hit count", () => {
    expect(swings.length).toBeGreaterThan(0);
    for (const s of swings) {
      expect(s.events.length).toBeLessThanOrEqual(3); // mechgun: 3 hits every step
      // Short swings only happen because the target died mid-swing.
      if (s.events.length < 3) expect(s.primaryKilled).toBe(true);
    }
    expect(swings.some((s) => s.events.length === 3)).toBe(true);
  });

  it("a single-target weapon never fans out across enemies", () => {
    for (const s of swings) {
      for (const e of s.events) expect(e.attack!.targetIndex).toBe(s.primaryIndex);
    }
  });

  it("swings can mix hits and misses, and every hit in a step shares the step's attack type", () => {
    const outcomes = swings.map((s) => s.events.map((e) => e.attack!.hit).join(","));
    expect(outcomes.some((o) => o.includes("true") && o.includes("false"))).toBe(true);
    const indexes = comboIndexes(swings);
    swings.forEach((s, i) => {
      const type = PATTERN[indexes[i] % PATTERN.length];
      for (const e of s.events) expect(e.text).toContain(`${type}-attacks`);
    });
  });

  it("a target killed mid-swing receives no overkill hits and kill handling is immediate", () => {
    for (const s of swings.filter((s) => s.primaryKilled)) {
      const last = s.events[s.events.length - 1].attack!;
      expect(last.hit).toBe(true);
      expect(last.hpAfter).toBe(0);
    }
  });
});

describe("multi-target sweeps in the run loop (run-simulation)", () => {
  const result = simulateRun(input(kindIndex("sword"), 42));
  const swings = charSwings(result.events);

  it("sweeps strike up to maxTargets living enemies once each, in roster order", () => {
    for (const s of swings) {
      const targets = s.events.map((e) => e.attack!.targetIndex!);
      expect(targets.length).toBeLessThanOrEqual(4); // sword: 4 targets
      for (let i = 1; i < targets.length; i++) expect(targets[i]).toBeGreaterThan(targets[i - 1]);
    }
    expect(swings.some((s) => s.events.length > 1)).toBe(true);
  });

  it("a mid-swing kill removes the target from the rest of the swing", () => {
    for (const s of swings) {
      // Sword profile is 1 hit per target, so a killed target's index appears
      // exactly once; combined with the ascending-order check above, no event
      // after a kill can strike the dead enemy.
      const targets = s.events.map((e) => e.attack!.targetIndex!);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it("combo resets on primary kill only; secondary sweep kills keep the burst", () => {
    const secondaryOnly = swings.filter((s) => !s.primaryKilled && s.killedIndexes.length > 0);
    expect(secondaryOnly.length).toBeGreaterThan(0); // the scenario actually occurs
    const indexes = comboIndexes(swings);
    swings.forEach((s, i) => {
      const type = PATTERN[indexes[i] % PATTERN.length];
      for (const e of s.events) expect(e.text).toContain(`${type}-attacks`);
    });
  });

  it("sweeps never engage queued enemies (enemy actors attack in contiguous blocks)", () => {
    // With ENGAGED_ENEMIES = 1 the attacking-enemy sequence per room must be
    // contiguous per actor — a sweep-struck queued enemy starting its clock
    // early would interleave a new actor before the engaged one died.
    let room = -1;
    let seen: number[] = [];
    for (const e of result.events) {
      if (e.kind === "room") {
        room++;
        seen = [];
        continue;
      }
      const actor =
        e.kind === "attack" && e.attack && e.attack.actor !== "char"
          ? e.attack.actor
          : e.kind === "sidestep"
            ? e.sidestep!.actor
            : null;
      if (actor === null) continue;
      if (seen[seen.length - 1] !== actor) {
        expect(seen).not.toContain(actor); // an actor never resumes after another took over
        seen.push(actor);
      }
    }
  });
});

describe("determinism and timing under fan-out", () => {
  it("same (runId, seed) reproduces identical logs for multi-hit and multi-target weapons", () => {
    for (const kind of [kindIndex("mechgun"), kindIndex("sword")]) {
      const a = simulateRun(input(kind, 7));
      const b = simulateRun(input(kind, 7));
      expect(b.events).toEqual(a.events);
      expect(b.loot).toEqual(a.loot);
    }
  });

  it("a swing bills one frame-data step duration regardless of hit count", () => {
    const kind = kindIndex("mechgun");
    const result = simulateRun(input(kind, 77));
    const swings = charSwings(result.events);
    const indexes = comboIndexes(swings);
    const rig = rigForClass(startingCharacter().classId);
    for (let i = 1; i < swings.length; i++) {
      if (swings[i].room !== swings[i - 1].room) continue; // room entry uses the engage delay
      const idx = indexes[i - 1];
      const expected = nextComboDelay(
        rig,
        kind,
        PATTERN[idx % PATTERN.length],
        idx % 3,
        swings[i - 1].primaryKilled,
        0,
      );
      // Hits within the previous swing were simultaneous; the gap to the next
      // swing is the step's billed duration alone, whether 1 or 3 hits landed.
      expect(swings[i].t - swings[i - 1].t).toBe(expected);
    }
  });
});
