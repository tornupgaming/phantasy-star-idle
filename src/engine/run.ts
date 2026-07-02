/**
 * Run simulation engine (tasks 7.1–7.6; two-clock exchange 3.5).
 *
 * `simulateRun(input)` is a deterministic, pure function of its input (design D11).
 * It plays the character room-by-room through an area: it schedules character and
 * enemy attacks on independent cadences (the two clocks), auto-loots on kill and
 * box-open through the loot filter, auto-heals / revives / ejects per the survival
 * rules, and produces a timestamped battle log. Re-running with the same input
 * reproduces an identical log + loot (verified in tests/replay.test.ts).
 *
 * "Background ticking" and "offline resume" are just choosing how much game time
 * to reveal — see `revealUpTo`. The state layer advances that time from the saved
 * wall-clock timestamp; the run itself never reads the clock.
 */

import { createRng } from "./rng";
import type { Character } from "./character";
import { characterToCombatant, effectiveStats } from "./character";
import { AttackPattern, resolveAttack, type AttackType } from "./combat";
import { getArea, getEnemyDef, getDropTable } from "./content";
import { difficulty, type DifficultyId } from "./areas";
import { generateStage } from "./stage-gen";
import { instantiateEnemy, isDead, type EnemyInstance } from "./enemies";
import { engageDelayMs, nextComboDelay, enemyInterval } from "./pacing";
import { rigForClass } from "./classes";
import { attackSpeedBoost } from "./character";
import { KIND_FOR_ARCHETYPE } from "./items";
import type { Item } from "./items";
import { itemSellValue } from "./items";
import { filterItem, rollDrop, type LootFilter } from "./loot";
import type { Supply } from "./consumables";
import { addToSupply } from "./consumables";
import {
  autoHeal,
  autoRevive,
  needsHeal,
  type SurvivalConfig,
  DEFAULT_SURVIVAL,
} from "./survival";

/** 1 real ms = GAME_SPEED game ms. Tunable pacing knob for the balancing pass. */
export const GAME_SPEED = 1;

/** Small fixed times (game ms) for non-combat beats, kept for deterministic ordering. */
const BOX_OPEN_MS = 250;
const ROOM_TRAVEL_MS = 600;
/** Safety cap: if combat stalls (mutual 0-damage) force an eject to avoid a hang. */
const MAX_COMBAT_STEPS = 200_000;

/**
 * How many enemies in a room attack concurrently. Authentic spawn waves can be
 * large (a Monest brood, a 4-wolf pack), but in PSO mobs aggro in small
 * groups; an idle character can't kite, so the rest close in one at a time as
 * engaged enemies die (an activating enemy starts its attack clock on
 * activation). The character still fights the roster in listed order.
 */
const ENGAGED_ENEMIES = 1;
const MONEST_BROOD_SPAWN_MS = 5_000;
const MONEST_INITIAL_BROOD_MIN = 2;
const MONEST_INITIAL_BROOD_MAX = 2;
const MONEST_INITIAL_BEFORE_MIN = 1;
const MONEST_INITIAL_BEFORE_MAX = 1;

interface ActiveBrood {
  sourceIndex: number;
  childEnemyId: string;
  total: number;
  spawned: number;
  nextSpawn: number;
}

export interface RunInput {
  runId: string;
  seed: number;
  areaId: string;
  difficultyId: DifficultyId;
  character: Character; // snapshot at send time
  supply: Supply; // snapshot at send time
  filter: LootFilter;
  pattern: AttackType[];
  survival?: SurvivalConfig;
}

export type RunOutcome = "complete" | "ejected";

export type RunEventKind =
  | "room"
  | "spawn"
  | "attack"
  | "kill"
  | "box"
  | "loot"
  | "heal"
  | "revive"
  | "eject"
  | "complete";

/**
 * Structured event payloads (battle-scene-view D1). The scene renderer folds
 * these instead of parsing `text`; enemies are identified by their index in the
 * room roster, which is unambiguous even with duplicate names.
 */
export interface RoomEventData {
  roomIndex: number; // 0-based
  totalRooms: number;
  boxes: number;
  /** Roster in fixed order; the index identifies each enemy for the whole room. */
  enemies: { id: string; name: string; maxHp: number }[];
}

export interface SpawnEventData {
  enemyIndex: number;
  id: string;
  name: string;
  maxHp: number;
}

export interface AttackEventData {
  actor: "char" | number; // attacking enemy's roster index, or the character
  targetIndex: number | null; // set when the character attacks
  hit: boolean;
  crit: boolean;
  damage: number;
  /** Target's HP after the swing (the character's HP for enemy attacks). */
  hpAfter: number;
}

export interface KillEventData {
  enemyIndex: number;
  xp: number;
}

export interface HpEventData {
  itemId: string; // consumable used
  hpAfter: number;
}

export interface RunEvent {
  t: number; // game ms since run start
  kind: RunEventKind;
  text: string;
  // Kind-specific payloads (present on the matching kind only).
  room?: RoomEventData;
  spawn?: SpawnEventData;
  attack?: AttackEventData;
  kill?: KillEventData;
  hp?: HpEventData;
}

export interface RunLoot {
  meseta: number;
  items: Item[];
  consumables: Supply; // gained (added to post-run stock)
  grinders: number;
}

export interface RunResult {
  runId: string;
  areaId: string;
  difficultyId: DifficultyId;
  outcome: RunOutcome;
  endTime: number; // game ms at which the run ended
  events: RunEvent[];
  loot: RunLoot;
  consumablesUsed: Supply;
  /** Total XP from kills; applied to the dispatched character at settle, never mid-run. */
  xpGained: number;
  roomsCleared: number;
  totalRooms: number;
  /** The generated stage's per-room plan (enemy/box counts, for the room strip UI). */
  roomPlan: { enemies: number; boxes: number }[];
}

export function simulateRun(input: RunInput): RunResult {
  const rng = createRng(input.runId, input.seed);
  const area = getArea(input.areaId);
  const diff = difficulty(input.difficultyId);
  const survival = input.survival ?? DEFAULT_SURVIVAL;
  // The stage roll consumes RNG draws first, in a fixed order — the same
  // (runId, seed) reproduces the identical layout and battle (design D11).
  const stage = generateStage(area, rng);

  const charCombatant = characterToCombatant(input.character);
  const maxHp = effectiveStats(input.character).hp;
  // Frame-data timing inputs, all derived from the dispatch-time snapshot
  // (character-equipment spec: mid-run equip changes don't perturb a replay).
  // Item-table weapons carry their authentic animation category; curated/old
  // weapons fall back through their coarse archetype; barehanded = fists.
  const weapon = input.character.equipment.weapon;
  const weaponKind = weapon ? (weapon.weaponKind ?? KIND_FOR_ARCHETYPE[weapon.weaponType]) : null;
  const rig = rigForClass(input.character.classId);
  const speedBoost = attackSpeedBoost(input.character.equipment);
  const pattern = new AttackPattern(input.pattern.length ? input.pattern : ["normal"]);
  const supply: Supply = { ...input.supply };

  // Deterministic instance-id minting (consumed in fixed order → replayable).
  let itemSeq = 0;
  const mintId = () => `${input.runId}-item-${itemSeq++}`;

  const events: RunEvent[] = [];
  const loot: RunLoot = { meseta: 0, items: [], consumables: {}, grinders: 0 };
  const consumablesUsed: Supply = {};

  let t = 0;
  let charHp = maxHp;
  let charAttackIndex = 0;
  let outcome: RunOutcome = "complete";
  let roomsCleared = 0;
  let xpGained = 0;
  const roomPlan: { enemies: number; boxes: number }[] = [];

  const log = (
    kind: RunEventKind,
    text: string,
    data?: Pick<RunEvent, "room" | "spawn" | "attack" | "kill" | "hp">,
  ) => events.push({ t, kind, text, ...data });

  // `mesetaBase` overrides the rolled meseta amount — enemy kills award the
  // authentic per-enemy meseta from the stat row; boxes keep the rolled range.
  const applyDrop = (tableId: string, tier: number, source: string, mesetaBase?: number) => {
    const out = rollDrop(getDropTable(tableId), tier, rng, mintId);
    if (out.meseta > 0) {
      const gained = Math.floor((mesetaBase ?? out.meseta) * diff.mesetaMult);
      loot.meseta += gained;
      log("loot", `${source} dropped ${gained} meseta.`);
    }
    if (out.item) {
      const decision = filterItem(out.item, input.filter);
      if (decision === "sell") {
        const value = itemSellValue(out.item);
        loot.meseta += value;
        log("loot", `${source} dropped ${out.item.name} — auto-sold for ${value} meseta.`);
      } else {
        loot.items.push(out.item);
        log("loot", `${source} dropped ${out.item.name} — kept.`);
      }
    }
    if (out.consumable) {
      addToSupply(loot.consumables, out.consumable.id, out.consumable.count);
      // Picked-up consumables are usable for the rest of the run (PSO-style
      // pickup); settle nets them out as gained − used, so no double count.
      addToSupply(supply, out.consumable.id, out.consumable.count);
      log("loot", `${source} dropped ${out.consumable.count}× ${out.consumable.id}.`);
    }
    if (out.grinders > 0) {
      loot.grinders += out.grinders;
      log("loot", `${source} dropped ${out.grinders}× grinder.`);
    }
  };

  // Returns true if the character survived the hit (possibly via revive/heal).
  const onCharacterDamaged = (): boolean => {
    if (charHp > 0) {
      if (needsHeal(charHp, maxHp, survival)) {
        const heal = autoHeal(charHp, maxHp, supply);
        if (heal) {
          charHp = heal.newHp;
          addToSupply(consumablesUsed, heal.itemId, 1);
          log("heal", `Auto-used ${heal.itemId} (+${heal.amount} HP → ${charHp}).`, {
            hp: { itemId: heal.itemId, hpAfter: charHp },
          });
        }
      }
      return true;
    }
    // HP reached 0 → try revive
    const revive = autoRevive(maxHp, supply);
    if (revive) {
      charHp = revive.newHp;
      addToSupply(consumablesUsed, revive.itemId, 1);
      log("revive", `Revived with ${revive.itemId} (HP → ${charHp}).`, {
        hp: { itemId: revive.itemId, hpAfter: charHp },
      });
      // A partial-HP revive usually lands below the healing threshold; heal
      // immediately (auto-heal requirement) or the next hit re-kills and
      // chain-burns the revive stock.
      if (needsHeal(charHp, maxHp, survival)) {
        const heal = autoHeal(charHp, maxHp, supply);
        if (heal) {
          charHp = heal.newHp;
          addToSupply(consumablesUsed, heal.itemId, 1);
          log("heal", `Auto-used ${heal.itemId} (+${heal.amount} HP → ${charHp}).`, {
            hp: { itemId: heal.itemId, hpAfter: charHp },
          });
        }
      }
      return true;
    }
    return false; // eject
  };

  roomLoop: for (let r = 0; r < stage.rooms.length; r++) {
    const room = stage.rooms[r];

    let roomEnemyIds = [...room.enemies];
    const broods: ActiveBrood[] = [];
    for (const brood of room.broods ?? []) {
      const sourceIndex = roomEnemyIds.indexOf(brood.sourceEnemyId);
      if (sourceIndex < 0 || brood.total <= 0) continue;
      const initial = Math.min(brood.total, rng.int(MONEST_INITIAL_BROOD_MIN, MONEST_INITIAL_BROOD_MAX));
      const beforeSource = Math.min(
        initial,
        rng.int(MONEST_INITIAL_BEFORE_MIN, MONEST_INITIAL_BEFORE_MAX),
      );
      const before = Array.from({ length: beforeSource }, () => brood.childEnemyId);
      const after = Array.from({ length: initial - beforeSource }, () => brood.childEnemyId);
      roomEnemyIds.splice(sourceIndex, 1, ...before, brood.sourceEnemyId, ...after);
      broods.push({
        sourceIndex: sourceIndex + beforeSource,
        childEnemyId: brood.childEnemyId,
        total: brood.total,
        spawned: initial,
        nextSpawn: t + MONEST_BROOD_SPAWN_MS,
      });
    }

    const enemies: EnemyInstance[] = roomEnemyIds.map((id) =>
      instantiateEnemy(getEnemyDef(id), input.difficultyId),
    );
    roomPlan.push({ enemies: enemies.length, boxes: room.boxes });
    log("room", `Entering room ${r + 1} of ${stage.rooms.length}.`, {
      room: {
        roomIndex: r,
        totalRooms: stage.rooms.length,
        boxes: room.boxes,
        enemies: enemies.map((e, i) => ({
          id: roomEnemyIds[i],
          name: e.name,
          maxHp: e.maxHp,
        })),
      },
    });

    // Two independent clocks. The character's first swing lands after one
    // approach (recovery + first step — closing distance to the first target).
    let charNext = t + engageDelayMs(rig, weaponKind, pattern.typeAt(0), speedBoost);
    const enemyNext = enemies.map((e) => t + enemyInterval(e.def.enemyType));
    charAttackIndex = 0;

    // Trickle aggro: the first ENGAGED_ENEMIES are active; the rest activate
    // (clock started from the current time) as engaged enemies fall.
    const engaged = enemies.map((_, i) => i < ENGAGED_ENEMIES);
    const engagedLivingCount = () =>
      enemies.filter((e, idx) => engaged[idx] && !isDead(e)).length;
    const engageNext = () => {
      while (engagedLivingCount() < ENGAGED_ENEMIES) {
        const i = enemies.findIndex((e, idx) => !engaged[idx] && !isDead(e));
        if (i < 0) return;
        engaged[i] = true;
        enemyNext[i] = t + enemyInterval(enemies[i].def.enemyType);
      }
    };

    let steps = 0;
    while (enemies.some((e) => !isDead(e))) {
      if (++steps > MAX_COMBAT_STEPS) {
        outcome = "ejected";
        log("eject", `Combat stalled — the character is ejected to base.`);
        break roomLoop;
      }

      // Pick the next actor by earliest clock; ties: character first, then enemy index, then spawns.
      let actor: "char" | number | { spawn: ActiveBrood } = "char";
      let best = charNext;
      for (let i = 0; i < enemies.length; i++) {
        if (!engaged[i] || isDead(enemies[i])) continue;
        if (enemyNext[i] < best) {
          best = enemyNext[i];
          actor = i;
        }
      }
      for (const brood of broods) {
        if (brood.spawned >= brood.total || isDead(enemies[brood.sourceIndex])) continue;
        if (brood.nextSpawn < best) {
          best = brood.nextSpawn;
          actor = { spawn: brood };
        }
      }
      t = best;

      if (typeof actor === "object") {
        const brood = actor.spawn;
        const enemy = instantiateEnemy(getEnemyDef(brood.childEnemyId), input.difficultyId);
        const enemyIndex = enemies.length;
        enemies.push(enemy);
        roomEnemyIds.push(brood.childEnemyId);
        enemyNext.push(t + enemyInterval(enemy.def.enemyType));
        engaged.push(false);
        brood.spawned++;
        brood.nextSpawn += MONEST_BROOD_SPAWN_MS;
        engageNext();
        log("spawn", `${enemy.name} emerges from the Monest brood.`, {
          spawn: { enemyIndex, id: brood.childEnemyId, name: enemy.name, maxHp: enemy.maxHp },
        });
        continue;
      }

      if (actor === "char") {
        const targetIndex = enemies.findIndex((e) => !isDead(e));
        if (targetIndex < 0) break;
        const target = enemies[targetIndex];
        const type = pattern.typeAt(charAttackIndex);
        const step = pattern.comboStepAt(charAttackIndex);
        const out = resolveAttack(charCombatant, target.combatant, type, step, rng);
        let killed = false;
        if (!out.hit) {
          log("attack", `${input.character.name} ${type}-attacks ${target.name} — miss.`, {
            attack: { actor: "char", targetIndex, hit: false, crit: false, damage: 0, hpAfter: target.hp },
          });
          charAttackIndex++; // pattern/combo still advances on a miss
        } else {
          target.hp -= out.damage;
          const crit = out.crit ? " CRIT" : "";
          log(
            "attack",
            `${input.character.name} ${type}-attacks ${target.name} —${crit} ${out.damage} dmg (HP ${Math.max(0, target.hp)}/${target.maxHp}).`,
            {
              attack: {
                actor: "char",
                targetIndex,
                hit: true,
                crit: out.crit,
                damage: out.damage,
                hpAfter: Math.max(0, target.hp),
              },
            },
          );
          if (isDead(target)) {
            killed = true;
            // Authentic per-difficulty award from the stat row — no multiplier.
            const xp = target.stats.exp;
            xpGained += xp;
            log("kill", `${target.name} defeated. (+${xp} XP)`, {
              kill: { enemyIndex: targetIndex, xp },
            });
            applyDrop(target.def.dropTableId, diff.dropTier, target.name, target.stats.meseta);
            engageNext(); // a queued enemy closes in to replace the fallen one
            charAttackIndex = 0; // combo resets on a new target
          } else {
            charAttackIndex++;
          }
        }
        // Burst rhythm: chained steps bill their Combo duration; a finished
        // burst or a kill bills the Full duration (the animation's recovery
        // tail) plus the repositioning pause to the next enemy.
        charNext += nextComboDelay(rig, weaponKind, type, step, killed, speedBoost);
      } else {
        const e = enemies[actor];
        const out = resolveAttack(e.combatant, charCombatant, "normal", 0, rng);
        if (!out.hit) {
          log("attack", `${e.name} attacks — miss.`, {
            attack: { actor, targetIndex: null, hit: false, crit: false, damage: 0, hpAfter: charHp },
          });
        } else {
          charHp -= out.damage;
          const crit = out.crit ? " CRIT" : "";
          log(
            "attack",
            `${e.name} attacks —${crit} ${out.damage} dmg (your HP ${Math.max(0, charHp)}/${maxHp}).`,
            {
              attack: {
                actor,
                targetIndex: null,
                hit: true,
                crit: out.crit,
                damage: out.damage,
                hpAfter: Math.max(0, charHp),
              },
            },
          );
          if (!onCharacterDamaged()) {
            outcome = "ejected";
            log("eject", `${input.character.name} fell with no revive left — ejected, keeping all loot.`);
            break roomLoop;
          }
        }
        enemyNext[actor] += enemyInterval(e.def.enemyType);
      }
    }

    // Room cleared — open every box (after combat), then travel to the next room.
    for (let b = 0; b < room.boxes; b++) {
      t += BOX_OPEN_MS;
      log("box", `Opened item box ${b + 1}.`);
      applyDrop(area.boxDropTableId, diff.dropTier, "Item box");
    }
    roomsCleared++;
    t += ROOM_TRAVEL_MS;
  }

  if (outcome === "complete") {
    log("complete", `Area cleared! Returning to base with the loot.`);
  }

  return {
    runId: input.runId,
    areaId: input.areaId,
    difficultyId: input.difficultyId,
    outcome,
    endTime: t,
    events,
    loot,
    consumablesUsed,
    xpGained,
    roomsCleared,
    totalRooms: stage.rooms.length,
    roomPlan,
  };
}

/** The portion of a finished run's timeline visible at `gameTime` (background reveal). */
export function revealUpTo(result: RunResult, gameTime: number): RunEvent[] {
  return result.events.filter((e) => e.t <= gameTime);
}

/** Whether the run has fully played out by `gameTime`. */
export function isRunFinished(result: RunResult, gameTime: number): boolean {
  return gameTime >= result.endTime;
}
