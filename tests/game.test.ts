import { describe, it, expect } from "vitest";
import { memoryStorage } from "../src/engine/save";
import { Game, OFFLINE_CAP_MS } from "../src/engine/game";
import { sectionIdFromName } from "../src/engine/progression";
import { GEAR } from "../src/engine/content";
import type { Item, Weapon } from "../src/engine/items";

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
    const storage = memoryStorage();
    const game = Game.loadOrNew(storage, clock.now);
    const mesetaBefore = game.state.economy.meseta;
    game.sendRun("forest", "normal");

    expect(game.poll()).toBe(false); // not finished immediately
    clock.advance(24 * 60 * 60 * 1000); // a full day passes
    expect(game.poll()).toBe(true); // settles now
    expect(game.state.activeRun).toBeNull();
    expect(game.state.lastReport).not.toBeNull();
    expect(game.state.lastReportDismissed).toBe(false); // fresh reports should open once
    expect(game.state.lastReport!.outcome).toBe("complete");
    expect(game.state.economy.meseta).toBeGreaterThanOrEqual(mesetaBefore);

    game.dismissLastReport();
    expect(game.state.lastReport).not.toBeNull(); // keep the report data for history
    expect(game.state.lastReportDismissed).toBe(true);
    const reloaded = Game.loadOrNew(storage, clock.now);
    expect(reloaded.state.lastReport).toEqual(game.state.lastReport);
    expect(reloaded.state.lastReportDismissed).toBe(true);
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
  it("locks an owned item and refuses to sell it", () => {
    const storage = memoryStorage();
    const clock = fakeClock();
    const game = Game.loadOrNew(storage, clock.now);
    const item = { ...GEAR.greatBlade, id: "keep-me" } as Item;
    game.state.economy.inventory.push(item);

    expect(game.setInventoryItemLocked(item.id, true)).toEqual({ ok: true });
    expect(game.sellInventoryItem(item.id)).toEqual({ ok: false, reason: "item is locked" });
    expect(game.state.economy.inventory.find((owned) => owned.id === item.id)?.locked).toBe(true);

    const reloaded = Game.loadOrNew(storage, clock.now);
    expect(reloaded.state.economy.inventory.find((owned) => owned.id === item.id)?.locked).toBe(true);
  });

  it("sell all sells unlocked inventory while preserving locked and equipped items", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    const equipped = game.selectedCharacter().equipment.weapon!;
    const locked = { ...GEAR.greatBlade, id: "locked", locked: true } as Item;
    const saleA = { ...GEAR.handBlade, id: "sale-a" } as Item;
    const saleB = { ...GEAR.powerUnit, id: "sale-b" } as Item;
    const otherCharacterWeapon = { ...GEAR.handBlade, id: "other-equipped" } as Item;
    game.state.economy.inventory.push(locked, saleA, saleB, otherCharacterWeapon);
    expect(game.createCharacter("Rico", "ramarl")).toEqual({ ok: true });
    const otherCharacterId = game.state.roster[1].character.id;
    expect(game.selectCharacter(otherCharacterId)).toEqual({ ok: true });
    expect(game.equipFromInventory(otherCharacterWeapon.id)).toEqual({ ok: true });
    expect(game.selectCharacter(game.state.roster[0].character.id)).toEqual({ ok: true });
    const mesetaBefore = game.state.economy.meseta;
    // Equipping otherCharacterWeapon displaced Rico's starter handgun back into
    // the shared inventory; it too is unlocked, so sell-all clears it as well.
    const unlockedValue = game.state.economy.inventory
      .filter((item) => !item.locked)
      .reduce((sum, item) => sum + item.sellValue, 0);

    expect(game.sellAllInventoryItems()).toEqual({ ok: true });
    expect(game.state.economy.inventory.map((item) => item.id)).toEqual(["locked"]);
    expect(game.state.economy.meseta).toBe(mesetaBefore + unlockedValue);
    expect(game.selectedCharacter().equipment.weapon).toBe(equipped);
    expect(game.state.roster[1].character.equipment.weapon?.id).toBe(otherCharacterWeapon.id);
  });

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
  });

  it("equips a new character with a basic frame and a role-appropriate weapon", () => {
    const game = newGame();
    const cases: Array<{ classId: string; weaponType: string }> = [
      { classId: "humar", weaponType: "saber" }, // hunter
      { classId: "ramarl", weaponType: "handgun" }, // ranger
      { classId: "fomar", weaponType: "cane" }, // force
    ];
    for (const { classId, weaponType } of cases) {
      expect(game.createCharacter(`New-${classId}`, classId).ok).toBe(true);
      const c = game.state.roster.at(-1)!.character;
      expect(c.equipment.weapon).not.toBeNull();
      expect(c.equipment.weapon!.weaponType).toBe(weaponType);
      expect(c.equipment.frame).not.toBeNull();
      // Distinct instance ids so nothing collides in the shared inventory.
      expect(c.equipment.weapon!.id).toBe(`${c.id}-weapon`);
      expect(c.equipment.frame!.id).toBe(`${c.id}-frame`);
    }
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
    // Move char-1's starter weapon into the shared inventory, then equip it onto
    // Rico (displacing Rico's own starter weapon back into the inventory).
    game.unequipToInventory("weapon");
    const weaponId = game.state.economy.inventory.find((i) => i.id === "start-weapon")!.id;
    game.selectCharacter(ricoId);
    expect(game.equipFromInventory(weaponId).ok).toBe(true);
    const invBefore = game.state.economy.inventory.length;

    game.selectCharacter("char-1");
    expect(game.deleteCharacter(ricoId).ok).toBe(true);
    expect(game.state.roster).toHaveLength(1);
    // Rico's equipped weapon and starter frame both return to the inventory.
    expect(game.state.economy.inventory).toHaveLength(invBefore + 2);
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
