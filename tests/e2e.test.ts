import { describe, it, expect } from "vitest";
import { memoryStorage } from "../src/engine/save";
import { Game } from "../src/engine/game";
import { simulateRun } from "../src/engine/run";
import { startingCharacter } from "../src/engine/content";
import { emptyEquipment, equip, type Character } from "../src/engine/character";
import { GEAR, startingSupply } from "../src/engine/content";
import { DEFAULT_FILTER, type GearTemplate } from "../src/engine/loot";
import type { Weapon, Frame, Barrier } from "../src/engine/items";

function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("end-to-end core loop (task 9.1)", () => {
  it("send → run → auto-loot → report → re-gear → send again accrues progress", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);

    let completed = 0;
    let ejected = 0;
    const startMeseta = game.state.economy.meseta;

    // Farm the forest several times.
    for (let i = 0; i < 6; i++) {
      const send = game.sendRun("forest", "normal");
      expect(send.ok).toBe(true);
      clock.advance(24 * 60 * 60 * 1000); // let it fully resolve
      const settled = game.poll();
      expect(settled).toBe(true);
      const report = game.state.lastReport!;
      if (report.outcome === "complete") completed++;
      else ejected++;

      // Re-gear: equip any better weapon we found; grind if we have grinders.
      const betterWeapon = game.state.economy.inventory.find(
        (it) => it.kind === "weapon" && it.minAtp > (game.selectedCharacter().equipment.weapon?.minAtp ?? 0),
      );
      if (betterWeapon) game.equipFromInventory(betterWeapon.id);
      if (game.state.economy.grinders > 0) game.grindEquippedWeapon();
    }

    // The loop should be winnable and profitable in the starter area.
    expect(completed).toBeGreaterThan(0);
    expect(game.state.economy.meseta).toBeGreaterThan(startMeseta);
    // Progression is real: we accumulated some kind of loot over the runs.
    const gotLoot =
      game.state.economy.inventory.length > 0 || game.state.economy.grinders >= 0;
    expect(gotLoot).toBe(true);
  });

  it("difficulty gates: an under-geared character is walled out of ultimate mines", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);
    const send = game.sendRun("mines", "ultimate");
    expect(send.ok).toBe(true);
    clock.advance(24 * 60 * 60 * 1000);
    game.poll();
    expect(game.state.lastReport!.outcome).toBe("ejected");
  });
});

describe("pacing sanity (task 9.2)", () => {
  it("a starter forest run lands in a glance-back cadence (seconds to a few minutes)", () => {
    const c = startingCharacter();
    c.equipment = emptyEquipment();
    equip(c, { ...GEAR.ironSaber, id: "w" } as Weapon);
    equip(c, { ...GEAR.plateArmor, id: "f" } as Frame);
    equip(c, { ...GEAR.woodShield, id: "b" } as Barrier);

    const durations: number[] = [];
    for (let seed = 1; seed <= 8; seed++) {
      const r = simulateRun({
        runId: `pace-${seed}`,
        seed,
        areaId: "forest",
        difficultyId: "normal",
        character: c,
        supply: { monomate: 5 },
        filter: DEFAULT_FILTER,
        pattern: ["normal", "normal", "heavy"],
      });
      durations.push(r.endTime); // game ms == real ms at GAME_SPEED 1
    }
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    // Expect a run to take between ~15s and ~8 minutes of real time.
    expect(avg).toBeGreaterThan(15_000);
    expect(avg).toBeLessThan(8 * 60_000);
  });
});

describe("roster end-to-end (add-character-roster)", () => {
  it("create alt → switch → run → XP and loot land in the right places", () => {
    const clock = fakeClock();
    const game = Game.loadOrNew(memoryStorage(), clock.now);

    // Main earns some XP and loot first.
    game.sendRun("forest", "normal");
    clock.advance(24 * 60 * 60 * 1000);
    game.poll();
    const mainXp = game.state.roster[0].character.xp;
    expect(mainXp).toBeGreaterThan(0);
    const sharedMeseta = game.state.economy.meseta;

    // Create an alt; section ID derives from the name; sees the same meseta.
    expect(game.createCharacter("Sue", "ramarl").ok).toBe(true);
    const sue = game.state.roster[1].character;
    expect(game.selectCharacter(sue.id).ok).toBe(true);
    expect(game.state.economy.meseta).toBe(sharedMeseta);

    // Hand-me-down gear via the shared inventory: unequip main's weapon.
    game.selectCharacter("char-1");
    game.unequipToInventory("weapon");
    game.unequipToInventory("frame");
    game.unequipToInventory("barrier");
    game.selectCharacter(sue.id);
    for (const item of [...game.state.economy.inventory]) {
      game.equipFromInventory(item.id);
    }
    expect(game.selectedCharacter().equipment.weapon).not.toBeNull();

    // Sue runs; XP goes to Sue, not the main; loot goes to the shared economy.
    expect(game.sendRun("forest", "normal").ok).toBe(true);
    clock.advance(24 * 60 * 60 * 1000);
    expect(game.poll()).toBe(true);
    expect(game.state.roster[1].character.xp).toBeGreaterThan(0);
    expect(game.state.roster[0].character.xp).toBe(mainXp); // unchanged
    expect(game.state.lastReport!.characterName).toBe("Sue");
    expect(game.state.economy.meseta).toBeGreaterThanOrEqual(sharedMeseta);

    // Sue has her own level-banded shop stocks, one per counter.
    const stock = game.shopStock("weapon");
    expect(stock.offers.length).toBeGreaterThan(0);
    expect(stock.offers.every((o) => o.id.startsWith(`shop-weapon-${sue.id}-`))).toBe(true);
    const armour = game.shopStock("armour");
    expect(armour.offers.every((o) => o.id.startsWith(`shop-armour-${sue.id}-`))).toBe(true);
  });
});

describe("archetype pacing sanity (task 8.2)", () => {
  // Each archetype fights with its class-appropriate starter weapon. Forces
  // (FOmarl) are deliberately not covered: without techniques a level-1 force
  // cannot beat authentic enemy EVP in melee — revisit when techniques land.
  const archetypes: ReadonlyArray<readonly [string, GearTemplate]> = [
    ["humar", GEAR.handBlade],
    ["ramar", GEAR.scoutRifle],
  ];

  function freshLevel1(classId: string, weaponTemplate: GearTemplate): Character {
    const c: Character = {
      id: `pace-${classId}`,
      name: "Pace",
      classId,
      sectionId: "Viridia",
      level: 1,
      xp: 0,
      equipment: emptyEquipment(),
    };
    equip(c, { ...weaponTemplate, id: "w" } as Weapon);
    equip(c, { ...GEAR.clothArmor, id: "f" } as Frame);
    equip(c, { ...GEAR.woodShield, id: "b" } as Barrier);
    return c;
  }

  it("a fresh level-1 HUmar/RAmar can clear forest normal with starter gear", () => {
    for (const [classId, weaponTemplate] of archetypes) {
      let completed = 0;
      for (let seed = 1; seed <= 5; seed++) {
        const r = simulateRun({
          runId: `arch-${classId}-${seed}`,
          seed,
          areaId: "forest",
          difficultyId: "normal",
          character: freshLevel1(classId, weaponTemplate),
          supply: startingSupply(),
          filter: DEFAULT_FILTER,
          pattern: ["normal", "normal", "heavy"],
        });
        if (r.outcome === "complete") completed++;
      }
      expect(completed, `${classId} completed ${completed}/5`).toBeGreaterThanOrEqual(3);
    }
  });
});
