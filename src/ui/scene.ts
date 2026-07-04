/**
 * Battle scene reducer (battle-scene-view D2) — a pure fold over revealed run
 * events into "what the stage shows right now": current room, each enemy's HP
 * and alive/dead status, the character's HP, remaining supply, and a coarse
 * phase. Presentation state lives here (not in the engine); it is still pure
 * and unit-tested so mid-run reload can rebuild the scene from any event
 * prefix, and the incremental renderer can apply one event at a time.
 */

import type { RunEvent } from "../engine/run";
import type { Supply, ConsumableId } from "../engine/consumables";

export type ScenePhase = "traveling" | "fighting" | "looting" | "complete" | "ejected";

export interface SceneEnemy {
  id: string; // enemy definition id (sprite hook)
  name: string;
  hp: number;
  maxHp: number;
  dead: boolean;
}

/** What a revealed room's grid cell shows; grows with spawns as they appear. */
export interface SceneRoom {
  enemies: number;
  boxes: number;
}

export interface Scene {
  roomIndex: number; // 0-based; -1 before the first room event
  totalRooms: number;
  boxes: number;
  /** Revealed rooms by index (sparse up to roomIndex); unreached rooms are absent. */
  rooms: SceneRoom[];
  enemies: SceneEnemy[];
  charHp: number;
  charMaxHp: number;
  supply: Supply; // remaining usable consumables (snapshot minus used)
  phase: ScenePhase;
}

export function createScene(charMaxHp: number, supply: Supply): Scene {
  return {
    roomIndex: -1,
    totalRooms: 0,
    boxes: 0,
    rooms: [],
    enemies: [],
    charHp: charMaxHp,
    charMaxHp,
    supply: { ...supply },
    phase: "traveling",
  };
}

/** Apply one event in place. The renderer uses this per event; sceneAt folds it. */
export function applyEvent(scene: Scene, e: RunEvent): void {
  switch (e.kind) {
    case "room":
      if (e.room) {
        scene.roomIndex = e.room.roomIndex;
        scene.totalRooms = e.room.totalRooms;
        scene.boxes = e.room.boxes;
        scene.rooms[e.room.roomIndex] = { enemies: e.room.enemies.length, boxes: e.room.boxes };
        scene.enemies = e.room.enemies.map((x) => ({
          id: x.id,
          name: x.name,
          hp: x.maxHp,
          maxHp: x.maxHp,
          dead: false,
        }));
        scene.phase = scene.enemies.length ? "fighting" : "looting";
      }
      break;
    case "spawn":
      if (e.spawn) {
        scene.enemies[e.spawn.enemyIndex] = {
          id: e.spawn.id,
          name: e.spawn.name,
          hp: e.spawn.maxHp,
          maxHp: e.spawn.maxHp,
          dead: false,
        };
        scene.phase = "fighting";
        const room = scene.rooms[scene.roomIndex];
        if (room) room.enemies += 1; // revealed roster grows with the spawn
      }
      break;
    case "attack":
      if (e.attack?.hit) {
        if (e.attack.actor === "char") {
          const enemy = scene.enemies[e.attack.targetIndex ?? -1];
          if (enemy) enemy.hp = e.attack.hpAfter;
        } else {
          scene.charHp = e.attack.hpAfter;
        }
      }
      break;
    case "kill":
      if (e.kill) {
        const enemy = scene.enemies[e.kill.enemyIndex];
        if (enemy) {
          enemy.dead = true;
          enemy.hp = 0;
        }
        if (scene.enemies.every((x) => x.dead)) scene.phase = "looting";
      }
      break;
    case "heal":
    case "revive":
      if (e.hp) {
        scene.charHp = e.hp.hpAfter;
        const id = e.hp.itemId as ConsumableId;
        scene.supply[id] = Math.max(0, (scene.supply[id] ?? 0) - 1);
      }
      break;
    case "complete":
      scene.phase = "complete";
      break;
    case "eject":
      scene.phase = "ejected";
      break;
    // "box" and "loot" don't change scene state; they only ticker.
  }
}

/**
 * Room-based progress bar fill in [0, 1]: (roomsCleared + roomKills /
 * roomEnemies) / totalRooms, from revealed events only — outcome-blind by
 * construction. `totalRooms` comes from RunProgress so the bar works before
 * the first room event (the scene's own copy is 0 until then). Spawns grow
 * the current room's denominator, so the fill can dip slightly within a room,
 * but it never regresses past a cleared-room boundary.
 */
export function progressFill(scene: Scene, totalRooms: number): number {
  if (totalRooms <= 0 || scene.roomIndex < 0) return 0;
  if (scene.phase === "complete") return 1;
  const kills = scene.enemies.filter((e) => e.dead).length;
  // An empty or fully-cleared current room counts as done (0/0 → 1).
  const roomFraction = scene.enemies.length > 0 ? kills / scene.enemies.length : 1;
  return Math.min(1, Math.max(0, (scene.roomIndex + roomFraction) / totalRooms));
}

/** The scene after all `events` — deterministic fold from a fresh scene. */
export function sceneAt(events: RunEvent[], charMaxHp: number, supply: Supply): Scene {
  const scene = createScene(charMaxHp, supply);
  for (const e of events) applyEvent(scene, e);
  return scene;
}
