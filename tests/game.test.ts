import { describe, it, expect } from "vitest";
import { memoryStorage } from "../src/engine/save";
import { Game, OFFLINE_CAP_MS } from "../src/engine/game";
import { sectionIdFromName } from "../src/engine/progression";
import { GEAR } from "../src/engine/content";
import type { Weapon } from "../src/engine/items";

/** A controllable clock for deterministic time-travel in tests. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("run creation (task 7.1)", () => {
  it("sends a run and enforces a single active run", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    expect(game.selectedCharacter().equipment.weapon).not.toBeNull(); // starter auto-equipped

    const first = game.sendRun("forest", "normal");
    expect(first.ok).toBe(true);
    expect(game.state.activeRun).not.toBeNull();

    const second = game.sendRun("forest", "normal");
    expect(second.ok).toBe(false); // only one active run
  });

  it("snapshots the character so later gear changes don't affect the run", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    game.sendRun("forest", "normal");
    const snapshotLevel = game.state.activeRun!.input.character.level;
    game.selectedCharacter().level += 50; // mutate live character
    expect(game.state.activeRun!.input.character.level).toBe(snapshotLevel);
  });
});

describe("game clock + settle (tasks 7.4, 9.3)", () => {
  it("settles a run after enough game time elapses and produces a report", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    const mesetaBefore = game.state.economy.meseta;
    game.sendRun("forest", "normal");

    expect(game.poll()).toBe(false); // not finished immediately
    clock.advance(24 * 60 * 60 * 1000); // a full day passes
    expect(game.poll()).toBe(true); // settles now
    expect(game.state.activeRun).toBeNull();
    expect(game.state.lastReport).not.toBeNull();
    expect(game.state.lastReport!.outcome).toBe("complete");
    expect(game.state.economy.meseta).toBeGreaterThanOrEqual(mesetaBefore);
  });

  it("totalRooms is the full planned count even when the run ends in defeat early", () => {
    const clock = fakeClock();
    // Level-1 starter into ultimate Mines: guaranteed ejection long before the
    // last room. totalRooms must still be the stage's full plan, not the
    // truncated reached-room count (no outcome oracle).
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    expect(game.sendRun("mines", "ultimate").ok).toBe(true);
    const progress = game.runProgress()!;
    expect(progress.outcome).toBe("ejected");
    expect(progress.roomPlan.length).toBeLessThan(progress.totalRooms);
    expect(progress.totalRooms).toBeGreaterThan(0);
  });

  it("totalRooms matches the rooms actually reached on a completed run", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    game.sendRun("forest", "normal");
    const progress = game.runProgress()!;
    expect(progress.outcome).toBe("complete");
    expect(progress.totalRooms).toBe(progress.roomPlan.length);
  });

  it("offline cap bounds elapsed game time to a single run's worth", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    game.sendRun("forest", "normal");
    clock.advance(OFFLINE_CAP_MS * 100); // absurd absence
    const progress = game.runProgress()!;
    expect(progress.gameTime).toBeLessThanOrEqual(OFFLINE_CAP_MS);
    expect(progress.finished).toBe(true); // run still just completes, never over-accrues
  });
});

describe("persistence + resume (task 7.4)", () => {
  it("reloads mid-run and reproduces the identical timeline", () => {
    const storage = memoryStorage();
    const clock = fakeClock();
    const game = Game.loadOrNew(storage, clock.now);
    game.sendRun("forest", "normal");
    const full = game.runProgress()!; // simulate result cached
    clock.advance(3000);
    const midEventsBefore = game.runProgress()!.revealedEvents;

    // Simulate an app restart: new Game from the same storage + clock.
    const reloaded = Game.loadOrNew(storage, clock.now);
    const midEventsAfter = reloaded.runProgress()!.revealedEvents;
    expect(midEventsAfter).toEqual(midEventsBefore);
    expect(reloaded.runProgress()!.endTime).toBe(full.endTime);
  });
});

describe("meta-layer operations", () => {
  it("blocks gear changes during a run", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    game.sendRun("forest", "normal");
    const r = game.unequipToInventory("weapon");
    expect(r.ok).toBe(false);
  });

  it("refuses to equip an unmet-requirement item and keeps it in inventory", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    const rifle = { ...GEAR.scoutRifle, id: "req-rifle", requirements: { ata: 999 } } as Weapon;
    game.state.economy.inventory.push(rifle);
    const equippedBefore = game.selectedCharacter().equipment.weapon;

    const r = game.equipFromInventory("req-rifle");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("requires 999 ATA");
    // The item survives the refusal and the current weapon stays equipped.
    expect(game.state.economy.inventory.some((i) => i.id === "req-rifle")).toBe(true);
    expect(game.selectedCharacter().equipment.weapon).toBe(equippedBefore);
  });

  it("grinds the equipped weapon consuming a grinder", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    const before = game.selectedCharacter().equipment.weapon!.grind;
    const grindersBefore = game.state.economy.grinders;
    const r = game.grindEquippedWeapon();
    expect(r.ok).toBe(true);
    expect(game.selectedCharacter().equipment.weapon!.grind).toBe(before + 1);
    expect(game.state.economy.grinders).toBe(grindersBefore - 1);
  });
});

describe("character roster (character-roster spec)", () => {
  const newGame = () => Game.loadOrNew(memoryStorage(), fakeClock().now);

  it("starts with one selected character", () => {
    const game = newGame();
    expect(game.state.roster).toHaveLength(1);
    expect(game.selectedCharacter().classId).toBe("humar");
    expect(game.selectedCharacter().level).toBe(1);
  });

  it("creates a character with a derived section ID by default", () => {
    const game = newGame();
    const r = game.createCharacter("Rico", "ramarl");
    expect(r.ok).toBe(true);
    const rico = game.state.roster[1].character;
    expect(rico.classId).toBe("ramarl");
    expect(rico.sectionId).toBe(sectionIdFromName("Rico"));
    expect(rico.level).toBe(1);
    expect(rico.equipment.weapon).toBeNull();
  });

  it("honors a section ID override at creation", () => {
    const game = newGame();
    game.createCharacter("Kireek", "hucast", "Redria");
    expect(game.state.roster[1].character.sectionId).toBe("Redria");
  });

  it("rejects empty names, unknown classes, and unknown section IDs", () => {
    const game = newGame();
    expect(game.createCharacter("   ", "humar").ok).toBe(false);
    expect(game.createCharacter("X", "wizard").ok).toBe(false);
    // invalid section id rejected at runtime
    expect(game.createCharacter("X", "humar", "Rainbow" as never).ok).toBe(false);
  });

  it("has no roster size limit", () => {
    const game = newGame();
    for (let i = game.state.roster.length; i < 6; i++) {
      expect(game.createCharacter(`Alt${i}`, "humar").ok).toBe(true);
    }
    expect(game.state.roster).toHaveLength(6);
  });

  it("selects characters, but not during a run", () => {
    const game = newGame();
    game.createCharacter("Rico", "ramarl");
    const ricoId = game.state.roster[1].character.id;
    expect(game.selectCharacter(ricoId).ok).toBe(true);
    expect(game.selectedCharacter().name).toBe("Rico");
    expect(game.selectCharacter("char-1").ok).toBe(true);

    game.sendRun("forest", "normal");
    expect(game.selectCharacter(ricoId).ok).toBe(false); // locked during run
    expect(game.selectedCharacter().id).toBe("char-1");
  });

  it("per-character config: pattern changes follow the selected character", () => {
    const game = newGame();
    game.createCharacter("Rico", "ramarl");
    const ricoId = game.state.roster[1].character.id;
    game.setPattern(["heavy"]);
    game.selectCharacter(ricoId);
    expect(game.selectedEntry().pattern).toEqual(["normal", "normal", "heavy"]); // Rico untouched
    game.selectCharacter("char-1");
    expect(game.selectedEntry().pattern).toEqual(["heavy"]);
  });

  it("deletes a character, returning its gear to the shared inventory", () => {
    const game = newGame();
    game.createCharacter("Rico", "ramarl");
    const ricoId = game.state.roster[1].character.id;
    // Move the starter weapon from char-1 to Rico via the shared inventory.
    game.unequipToInventory("weapon");
    const weaponId = game.state.economy.inventory.find((i) => i.kind === "weapon")!.id;
    game.selectCharacter(ricoId);
    expect(game.equipFromInventory(weaponId).ok).toBe(true);
    const invBefore = game.state.economy.inventory.length;

    game.selectCharacter("char-1");
    expect(game.deleteCharacter(ricoId).ok).toBe(true);
    expect(game.state.roster).toHaveLength(1);
    expect(game.state.economy.inventory).toHaveLength(invBefore + 1); // weapon returned
    expect(game.state.economy.inventory.some((i) => i.id === weaponId)).toBe(true);
  });

  it("reassigns selection when the selected character is deleted", () => {
    const game = newGame();
    game.createCharacter("Rico", "ramarl");
    const ricoId = game.state.roster[1].character.id;
    game.selectCharacter(ricoId);
    expect(game.deleteCharacter(ricoId).ok).toBe(true);
    expect(game.selectedCharacter().id).toBe("char-1");
  });

  it("refuses to delete the last character or a running character", () => {
    const game = newGame();
    expect(game.deleteCharacter("char-1").ok).toBe(false); // last one

    game.createCharacter("Rico", "ramarl");
    game.sendRun("forest", "normal"); // char-1 dispatched
    expect(game.deleteCharacter("char-1").ok).toBe(false); // on a run
    const ricoId = game.state.roster[1].character.id;
    expect(game.deleteCharacter(ricoId).ok).toBe(true); // idle alt is deletable
  });
});

describe("XP from runs (character-progression spec)", () => {
  it("awards XP at settle, levels up, and reports it", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    game.sendRun("forest", "normal");
    expect(game.selectedCharacter().xp).toBe(0); // nothing mid-run
    clock.advance(24 * 60 * 60 * 1000);
    expect(game.poll()).toBe(true);

    const report = game.state.lastReport!;
    expect(report.outcome).toBe("complete");
    expect(report.xpGained).toBeGreaterThan(0);
    expect(report.characterName).toBe("Hunter");
    expect(game.selectedCharacter().xp).toBe(report.xpGained);
    expect(game.selectedCharacter().level).toBe(report.level);
    // XP is the sum of the run's kill awards (authentic Solo Ep1 Normal rows);
    // an authentic Forest 1 layout holds ~90 enemies, so a full clear levels a
    // fresh character several times.
    expect(report.xpGained).toBeGreaterThan(100);
    expect(report.levelsGained).toBeGreaterThanOrEqual(1);
    expect(report.levelsGained).toBe(report.level - 1);
  });

  it("credits the dispatched character, not other roster members", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    game.createCharacter("Rico", "ramarl");
    game.sendRun("forest", "normal"); // char-1 runs
    clock.advance(24 * 60 * 60 * 1000);
    game.poll();
    expect(game.state.roster[0].character.xp).toBeGreaterThan(0);
    expect(game.state.roster[1].character.xp).toBe(0);
  });
});
