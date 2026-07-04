import { describe, it, expect } from "vitest";
import { createScene, applyEvent, sceneAt, progressFill } from "../src/ui/scene";
import type { RunEvent } from "../src/engine/run";
import { emptyEquipment, equip, effectiveStats, type Character } from "../src/engine/character";
import { GEAR, startingCharacter } from "../src/engine/content";
import { DEFAULT_FILTER } from "../src/engine/loot";
import { simulateRun, type RunInput } from "../src/engine/run";
import type { Weapon, Frame, Barrier } from "../src/engine/items";

// Two same-named enemies — index, not name, must disambiguate.
const roomEvent: RunEvent = {
  t: 0,
  kind: "room",
  text: "Entering room 1 of 2.",
  room: {
    roomIndex: 0,
    totalRooms: 2,
    boxes: 1,
    enemies: [
      { id: "booma", name: "Booma", maxHp: 30 },
      { id: "booma", name: "Booma", maxHp: 30 },
    ],
  },
};

const charHits = (targetIndex: number, damage: number, hpAfter: number, t = 1): RunEvent => ({
  t,
  kind: "attack",
  text: "Hunter normal-attacks Booma — hit.",
  attack: { actor: "char", targetIndex, hit: true, crit: false, damage, hpAfter },
});

describe("scene reducer", () => {
  it("a room event resets the roster and enters the fighting phase", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent);
    expect(scene.roomIndex).toBe(0);
    expect(scene.totalRooms).toBe(2);
    expect(scene.boxes).toBe(1);
    expect(scene.enemies).toHaveLength(2);
    expect(scene.enemies[0]).toEqual({ id: "booma", name: "Booma", hp: 30, maxHp: 30, dead: false });
    expect(scene.phase).toBe("fighting");
  });

  it("spawn events append enemies at their roster index", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent);
    applyEvent(scene, {
      t: 2,
      kind: "spawn",
      text: "Mothmant emerges from the Monest brood.",
      spawn: { enemyIndex: 2, id: "mothmant", name: "Mothmant", maxHp: 8 },
    });
    expect(scene.enemies).toHaveLength(3);
    expect(scene.enemies[0].name).toBe("Booma");
    expect(scene.enemies[2]).toEqual({ id: "mothmant", name: "Mothmant", hp: 8, maxHp: 8, dead: false });
    applyEvent(scene, charHits(2, 8, 0, 3));
    applyEvent(scene, { t: 3, kind: "kill", text: "Mothmant defeated.", kill: { enemyIndex: 2, xp: 1 } });
    expect(scene.enemies[2].dead).toBe(true);
  });

  it("damage lands on the indexed enemy, not the name (duplicates)", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent);
    applyEvent(scene, charHits(1, 12, 18));
    expect(scene.enemies[0].hp).toBe(30); // untouched twin
    expect(scene.enemies[1].hp).toBe(18);
  });

  it("misses change nothing", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent);
    applyEvent(scene, {
      t: 1,
      kind: "attack",
      text: "Hunter normal-attacks Booma — miss.",
      attack: { actor: "char", targetIndex: 0, hit: false, crit: false, damage: 0, hpAfter: 30 },
    });
    expect(scene.enemies[0].hp).toBe(30);
    expect(scene.charHp).toBe(100);
  });

  it("enemy attacks reduce character HP; kill marks dead and flips to looting", () => {
    const scene = createScene(100, { monomate: 2 });
    applyEvent(scene, roomEvent);
    applyEvent(scene, {
      t: 2,
      kind: "attack",
      text: "Booma attacks — 9 dmg.",
      attack: { actor: 0, targetIndex: null, hit: true, crit: false, damage: 9, hpAfter: 91 },
    });
    expect(scene.charHp).toBe(91);

    applyEvent(scene, charHits(0, 30, 0, 3));
    applyEvent(scene, { t: 3, kind: "kill", text: "Booma defeated.", kill: { enemyIndex: 0, xp: 5 } });
    expect(scene.enemies[0].dead).toBe(true);
    expect(scene.phase).toBe("fighting"); // twin still alive

    applyEvent(scene, charHits(1, 30, 0, 4));
    applyEvent(scene, { t: 4, kind: "kill", text: "Booma defeated.", kill: { enemyIndex: 1, xp: 5 } });
    expect(scene.phase).toBe("looting");
  });

  it("heal restores HP and decrements the supply", () => {
    const scene = createScene(100, { monomate: 2 });
    applyEvent(scene, roomEvent);
    applyEvent(scene, {
      t: 5,
      kind: "heal",
      text: "Auto-used monomate (+20 HP → 95).",
      hp: { itemId: "monomate", hpAfter: 95 },
    });
    expect(scene.charHp).toBe(95);
    expect(scene.supply.monomate).toBe(1);
  });

  it("room events record revealed rooms; spawns grow the revealed roster", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent);
    expect(scene.rooms[0]).toEqual({ enemies: 2, boxes: 1 });
    applyEvent(scene, {
      t: 2,
      kind: "spawn",
      text: "Mothmant emerges from the Monest brood.",
      spawn: { enemyIndex: 2, id: "mothmant", name: "Mothmant", maxHp: 8 },
    });
    expect(scene.rooms[0]).toEqual({ enemies: 3, boxes: 1 });
    // Entering the next room keeps room 0's revealed counts intact.
    applyEvent(scene, {
      t: 5,
      kind: "room",
      text: "Entering room 2 of 2.",
      room: { roomIndex: 1, totalRooms: 2, boxes: 0, enemies: [{ id: "booma", name: "Booma", maxHp: 30 }] },
    });
    expect(scene.rooms[0]).toEqual({ enemies: 3, boxes: 1 });
    expect(scene.rooms[1]).toEqual({ enemies: 1, boxes: 0 });
  });

  it("complete and eject set the terminal phase", () => {
    const scene = createScene(100, {});
    applyEvent(scene, { t: 9, kind: "complete", text: "Area cleared!" });
    expect(scene.phase).toBe("complete");
    const scene2 = createScene(100, {});
    applyEvent(scene2, { t: 9, kind: "eject", text: "Ejected." });
    expect(scene2.phase).toBe("ejected");
  });
});

describe("progressFill (room-based progress bar)", () => {
  const kill = (enemyIndex: number, t = 2): RunEvent => ({
    t,
    kind: "kill",
    text: "Booma defeated.",
    kill: { enemyIndex, xp: 5 },
  });

  it("is 0 before the first room event, regardless of totalRooms", () => {
    const scene = createScene(100, {});
    expect(progressFill(scene, 7)).toBe(0);
    expect(progressFill(scene, 0)).toBe(0);
  });

  it("interpolates kills within the current room", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent); // room 0 of 2, two enemies
    expect(progressFill(scene, 2)).toBe(0);
    applyEvent(scene, charHits(0, 30, 0));
    applyEvent(scene, kill(0));
    expect(progressFill(scene, 2)).toBeCloseTo((0 + 1 / 2) / 2);
    applyEvent(scene, charHits(1, 30, 0));
    applyEvent(scene, kill(1));
    expect(progressFill(scene, 2)).toBeCloseTo(1 / 2); // room cleared = boundary
  });

  it("a spawn dips the fill within the room but never below a cleared-room boundary", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent);
    applyEvent(scene, kill(0));
    applyEvent(scene, kill(1));
    const boundary = progressFill(scene, 2); // room 0 cleared
    applyEvent(scene, {
      t: 5,
      kind: "room",
      text: "Entering room 2 of 2.",
      room: { roomIndex: 1, totalRooms: 2, boxes: 0, enemies: [{ id: "booma", name: "Booma", maxHp: 30 }] },
    });
    applyEvent(scene, kill(0, 6));
    const beforeSpawn = progressFill(scene, 2); // (1 + 1/1) / 2 = 1
    applyEvent(scene, {
      t: 7,
      kind: "spawn",
      text: "Mothmant emerges.",
      spawn: { enemyIndex: 1, id: "mothmant", name: "Mothmant", maxHp: 8 },
    });
    const afterSpawn = progressFill(scene, 2); // (1 + 1/2) / 2 — dipped
    expect(afterSpawn).toBeLessThan(beforeSpawn);
    expect(afterSpawn).toBeGreaterThanOrEqual(boundary); // never past the boundary
  });

  it("is exactly 1 once the run completes", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent);
    applyEvent(scene, { t: 9, kind: "complete", text: "Area cleared!" });
    expect(progressFill(scene, 2)).toBe(1);
  });

  it("an ejected run holds the last revealed fill (no jump to 1)", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent);
    applyEvent(scene, kill(0));
    const before = progressFill(scene, 7);
    applyEvent(scene, { t: 9, kind: "eject", text: "Ejected." });
    expect(progressFill(scene, 7)).toBe(before);
    expect(progressFill(scene, 7)).toBeLessThan(1);
  });

  it("clamps to [0, 1] and returns 0 for a zero denominator", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent);
    expect(progressFill(scene, 0)).toBe(0);
    applyEvent(scene, kill(0));
    applyEvent(scene, kill(1));
    expect(progressFill(scene, 1)).toBe(1); // (0 + 1) / 1, clamped territory
  });
});

describe("scene reducer over a real simulated run", () => {
  function geared(): Character {
    const c = startingCharacter();
    c.equipment = emptyEquipment();
    equip(c, { ...GEAR.ironSaber, id: "w" } as Weapon);
    equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
    equip(c, { ...GEAR.woodShield, id: "b" } as Barrier);
    return c;
  }
  const character = geared();
  const input: RunInput = {
    runId: "scene-run",
    seed: 123,
    areaId: "forest",
    difficultyId: "normal",
    character,
    supply: { monomate: 25, "moon-atomizer": 3 },
    filter: DEFAULT_FILTER,
    pattern: ["normal", "normal", "heavy"],
  };
  const maxHp = effectiveStats(character).hp;
  const result = simulateRun(input);

  it("folding a prefix equals incremental application (mid-run reload)", () => {
    const cut = Math.floor(result.events.length / 2);
    const folded = sceneAt(result.events.slice(0, cut), maxHp, input.supply);
    const incremental = createScene(maxHp, input.supply);
    for (const e of result.events.slice(0, cut)) applyEvent(incremental, e);
    expect(incremental).toEqual(folded);
    // The bar fill is a pure function of the scene, so reload reproduces it.
    expect(progressFill(folded, result.totalRooms)).toBe(
      progressFill(incremental, result.totalRooms),
    );
  });

  it("fill never regresses across room boundaries over the whole run", () => {
    const scene = createScene(maxHp, input.supply);
    let boundary = 0; // fill at the last room-cleared point
    let prevRoom = -1;
    for (const e of result.events) {
      applyEvent(scene, e);
      const fill = progressFill(scene, result.totalRooms);
      if (scene.roomIndex > prevRoom) {
        // Entering a new room: everything before it is a hard floor.
        boundary = scene.roomIndex / result.totalRooms;
        prevRoom = scene.roomIndex;
      }
      expect(fill).toBeGreaterThanOrEqual(boundary);
    }
    expect(progressFill(scene, result.totalRooms)).toBe(1); // completed run → full
  });

  it("the fold is deterministic", () => {
    const a = sceneAt(result.events, maxHp, input.supply);
    const b = sceneAt(result.events, maxHp, input.supply);
    expect(a).toEqual(b);
  });

  it("a completed run ends with every enemy in the final room dead", () => {
    const final = sceneAt(result.events, maxHp, input.supply);
    expect(final.phase).toBe("complete");
    expect(final.enemies.every((e) => e.dead)).toBe(true);
    expect(final.roomIndex).toBe(final.totalRooms - 1);
    expect(final.charHp).toBeGreaterThan(0);
  });
});
