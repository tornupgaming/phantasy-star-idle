import { describe, it, expect } from "vitest";
import { memoryStorage, SaveManager, SAVE_KEY, SAVE_VERSION } from "../src/engine/save";
import { Game, migrateSave, type GameState } from "../src/engine/game";
import { statsAtLevel, sectionIdFromName, xpForLevel, levelForXp } from "../src/engine/progression";
import { isTekked } from "../src/engine/items";

/** A realistic v1 save: the old single-character GameState shape. */
function v1Save() {
  return {
    version: 1,
    savedAt: 12345,
    state: {
      character: {
        name: "Ash",
        baseStats: { atp: 80, dfp: 30, ata: 70, evp: 35, lck: 15, mst: 10, hp: 320 },
        equipment: {
          weapon: {
            id: "start-weapon", defId: "hand-blade", name: "Hand Blade", kind: "weapon",
            rarity: "common", sellValue: 40, weaponType: "saber", minAtp: 35, spread: 18,
            attribute: 0.05, ata: 30, grind: 2, maxGrind: 5,
          },
          frame: null,
          barrier: null,
          units: [],
        },
        pvar: 10,
      },
      economy: { meseta: 4321, grinders: 3, inventory: [] },
      supply: { monomate: 7 },
      filter: { minKeepValue: 100, keepRarities: ["rare"] },
      pattern: ["heavy"],
      survival: { healAtPct: 0.5 },
      runCounter: 17,
      activeRun: { input: { runId: "run-17" } }, // in-flight run in the old format
      lastReport: null,
    },
  };
}

describe("v1 → v2 save migration (character-roster spec)", () => {
  it("migrates the legacy character into roster slot 1", () => {
    const state = migrateSave(1, v1Save().state)!;
    expect(state).not.toBeNull();
    expect(state.roster).toHaveLength(1);
    const c = state.roster[0].character;
    expect(c.name).toBe("Ash");
    expect(c.classId).toBe("humar");
    expect(c.sectionId).toBe(sectionIdFromName("Ash"));
    expect(c.equipment.weapon?.grind).toBe(2); // gear carried over
    expect(state.selectedCharacterId).toBe(c.id);
  });

  it("grants the lowest level whose derived stats cover the legacy stats", () => {
    const state = migrateSave(1, v1Save().state)!;
    const c = state.roster[0].character;
    const s = statsAtLevel("humar", c.level);
    const legacy = v1Save().state.character.baseStats;
    for (const k of ["atp", "dfp", "ata", "evp", "mst", "hp"] as const) {
      expect(s[k]).toBeGreaterThanOrEqual(legacy[k]);
    }
    // The level below must NOT cover them (lowest such level).
    const below = statsAtLevel("humar", c.level - 1);
    expect(
      (["atp", "dfp", "ata", "evp", "mst", "hp"] as const).some((k) => below[k] < legacy[k]),
    ).toBe(true);
    // XP is consistent with the granted level so future level-ups work.
    expect(c.xp).toBe(xpForLevel("humar", c.level));
    expect(levelForXp("humar", c.xp)).toBe(c.level);
  });

  it("carries over the shared economy and per-character config, drops the in-flight run", () => {
    const state = migrateSave(1, v1Save().state)!;
    expect(state.economy.meseta).toBe(4321);
    expect(state.supply.monomate).toBe(7);
    expect(state.roster[0].pattern).toEqual(["heavy"]);
    expect(state.activeRun).toBeNull();
    expect(state.runCounter).toBe(17);
  });

  it("loads a v1 save through Game.loadOrNew and re-persists at the current version", () => {
    const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(v1Save()) });
    const game = Game.loadOrNew(storage, () => 99999);
    expect(game.selectedCharacter().name).toBe("Ash");
    expect(game.state.economy.meseta).toBe(4321);
    // Migration was persisted at the new version.
    const reloaded = new SaveManager<GameState>(storage).load();
    expect(reloaded?.version).toBe(SAVE_VERSION);
    expect(reloaded?.migrated).toBeUndefined();
  });

  it("still rejects unknown versions and corrupt saves", () => {
    expect(migrateSave(99, v1Save().state)).toBeNull();
    expect(migrateSave(1, null)).toBeNull();
    expect(migrateSave(1, { nothing: true })).toBeNull();
    const storage = memoryStorage({ [SAVE_KEY]: "{not json" });
    const game = Game.loadOrNew(storage, () => 0);
    expect(game.state.roster[0].character.name).toBe("Hunter"); // fresh game
  });
});

/** A realistic v2 save: roster with the old single mixed gear stock. */
function v2Save() {
  return {
    version: 2,
    savedAt: 54321,
    state: {
      roster: [
        {
          character: {
            id: "char-1",
            name: "Ash",
            classId: "humar",
            sectionId: sectionIdFromName("Ash"),
            level: 7, // band 1
            xp: xpForLevel("humar", 7),
            equipment: { weapon: null, frame: null, barrier: null, units: [] },
          },
          filter: { autoSellBelow: 0, alwaysKeep: [] },
          pattern: ["normal", "heavy"],
          survival: { healAtPct: 0.4, fleeAtPct: 0.1 },
          // Old shape: one mixed ShopStock, not { weapon, armour }.
          shop: { band: 1, restock: 2, offers: [] },
        },
      ],
      selectedCharacterId: "char-1",
      charCounter: 1,
      economy: { meseta: 777, grinders: 2, inventory: [] },
      supply: { dimate: 3 },
      runCounter: 5,
      activeRun: null,
      lastReport: null,
    },
  };
}

describe("v2 → v3 save migration (pioneer2-hub-redesign)", () => {
  it("splits the mixed gear stock into weapon and armour stocks at the current level", () => {
    const state = migrateSave(2, v2Save().state)!;
    expect(state).not.toBeNull();
    const shop = state.roster[0].shop;
    expect(shop.weapon.level).toBe(7);
    expect(shop.armour.level).toBe(7);
    expect(shop.weapon.offers.every((o) => o.kind === "weapon")).toBe(true);
    expect(shop.armour.offers.every((o) => ["frame", "barrier", "unit"].includes(o.kind))).toBe(
      true,
    );
  });

  it("preserves everything the player owns", () => {
    const state = migrateSave(2, v2Save().state)!;
    expect(state.economy.meseta).toBe(777);
    expect(state.supply.dimate).toBe(3);
    expect(state.roster[0].pattern).toEqual(["normal", "heavy"]);
    expect(state.runCounter).toBe(5);
    expect(state.roster[0].character.level).toBe(7);
  });

  it("loads a v2 save through Game.loadOrNew and re-persists at v3", () => {
    const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(v2Save()) });
    const game = Game.loadOrNew(storage, () => 99999);
    expect(game.selectedCharacter().name).toBe("Ash");
    expect(game.shopStock("weapon").offers.length).toBeGreaterThan(0);
    const reloaded = new SaveManager<GameState>(storage).load();
    expect(reloaded?.version).toBe(SAVE_VERSION);
    expect(reloaded?.migrated).toBeUndefined();
  });

  it("v1 saves migrate through the full chain to the split-stock shape", () => {
    const state = migrateSave(1, v1Save().state)!;
    const shop = state.roster[0].shop;
    expect(shop.weapon.offers.every((o) => o.kind === "weapon")).toBe(true);
    expect(shop.armour.offers.length).toBeGreaterThan(0);
  });
});

/** An item as the old placeholder GEAR templates minted it: no code/stars. */
function legacyPlaceholderWeapon(id: string) {
  return {
    id, defId: "iron-saber", name: "Iron Saber", kind: "weapon",
    rarity: "uncommon", sellValue: 120, weaponType: "saber", minAtp: 55, spread: 25,
    attribute: 0.1, ata: 40, grind: 1, maxGrind: 5,
  };
}

/** A realistic v3 save: split stocks whose offers copy removed GEAR templates. */
function v3Save() {
  return {
    version: 3,
    savedAt: 654321,
    state: {
      roster: [
        {
          character: {
            id: "char-1",
            name: "Ash",
            classId: "humar",
            sectionId: sectionIdFromName("Ash"),
            level: 7,
            xp: xpForLevel("humar", 7),
            equipment: {
              weapon: legacyPlaceholderWeapon("equipped-w"),
              frame: null,
              barrier: null,
              units: [],
            },
          },
          filter: { autoSellBelow: 100, alwaysKeep: ["rare"] },
          pattern: ["normal", "heavy"],
          survival: { healAtPct: 0.4 },
          shop: {
            weapon: { band: 1, restock: 0, offers: [legacyPlaceholderWeapon("shop-old-0")] },
            armour: { band: 1, restock: 0, offers: [] },
          },
        },
      ],
      selectedCharacterId: "char-1",
      charCounter: 1,
      economy: { meseta: 777, grinders: 2, inventory: [legacyPlaceholderWeapon("inv-w")] },
      supply: { dimate: 3 },
      runCounter: 5,
      activeRun: null,
      lastReport: null,
    },
  };
}

describe("v3 → v4 save migration (authentic-drop-generation)", () => {
  it("regenerates shop stocks so no removed placeholder template is offered", () => {
    const state = migrateSave(3, v3Save().state)!;
    expect(state).not.toBeNull();
    const shop = state.roster[0].shop;
    for (const stock of [shop.weapon, shop.armour]) {
      expect(stock.offers.length).toBeGreaterThan(0);
      for (const offer of stock.offers) {
        expect(offer.code).toMatch(/^[0-9A-F]{6}$/); // authentic item-table template
      }
    }
  });

  it("player-owned legacy items survive untouched (inventory and equipped)", () => {
    const state = migrateSave(3, v3Save().state)!;
    expect(state.economy.inventory[0]).toEqual(legacyPlaceholderWeapon("inv-w"));
    expect(state.roster[0].character.equipment.weapon).toEqual(legacyPlaceholderWeapon("equipped-w"));
    expect(state.economy.meseta).toBe(777);
    expect(state.supply.dimate).toBe(3);
  });

  it("loads a v3 save through Game.loadOrNew and re-persists at v4", () => {
    const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(v3Save()) });
    const game = Game.loadOrNew(storage, () => 99999);
    expect(game.selectedCharacter().name).toBe("Ash");
    const reloaded = new SaveManager<GameState>(storage).load();
    expect(reloaded?.version).toBe(SAVE_VERSION);
    expect(reloaded?.migrated).toBeUndefined();
  });
});

describe("v4 → v5 save migration (authentic-shop-inventory)", () => {
  it("regenerates stocks in the {level, offers} shape and adds the tool counter", () => {
    // A v4 save's stocks share the v3 {band, restock} shape and lack `tool`.
    const state = migrateSave(4, v3Save().state)!;
    const shop = state.roster[0].shop;
    expect(shop.weapon.level).toBe(7);
    expect(shop.armour.level).toBe(7);
    expect(shop.tool.offers.length).toBeGreaterThan(0);
    expect((shop.weapon as { band?: number }).band).toBeUndefined();
  });

  it("weapons saved without a tekked field read as tekked", () => {
    const state = migrateSave(4, v3Save().state)!;
    const equipped = state.roster[0].character.equipment.weapon!;
    expect(equipped.tekked).toBeUndefined();
    expect(isTekked(equipped)).toBe(true);
  });
});

describe("v5 → v6 save migration (report dismissal)", () => {
  it("adds the persisted report-dismissal flag without dropping lastReport", () => {
    const old = migrateSave(4, v3Save().state)!;
    const report = {
      characterName: "Ash", areaName: "Forest", difficultyLabel: "Normal",
      outcome: "complete" as const, roomsCleared: 3, totalRooms: 3, meseta: 10,
      items: [], consumablesGained: {}, consumablesUsed: {}, grinders: 0,
      xpGained: 20, levelsGained: 0, level: 7,
    };
    const v5State = { ...old, lastReport: report };
    delete (v5State as { lastReportDismissed?: boolean }).lastReportDismissed;

    const state = migrateSave(5, v5State)!;
    expect(state.lastReport).toEqual(report);
    expect(state.lastReportDismissed).toBe(false);
  });
});

describe("current save round-trip: generated variance, tool items, and reports persist intact", () => {
  it("bonuses/special/slots/stars and inert tools survive save → load", () => {
    const storage = memoryStorage();
    const game = Game.loadOrNew(storage, () => 1000);
    const generatedWeapon = {
      id: "gen-w", defId: "000104", code: "000104", stars: 4, name: "Gladius",
      kind: "weapon" as const, rarity: "uncommon" as const, sellValue: 653,
      weaponType: "saber" as const, weaponKind: 1, group: 1, minAtp: 240, spread: 40,
      attribute: 0, ata: 40, grind: 7, maxGrind: 18,
      bonuses: { native: 15, hit: -10 }, special: 3,
      requirements: { atp: 296 },
    };
    const generatedFrame = {
      id: "gen-f", defId: "010103", code: "010103", stars: 1, name: "Giga Frame",
      kind: "frame" as const, rarity: "common" as const, sellValue: 90,
      dfp: 17, evp: 13, unitSlots: 2, slots: 2,
    };
    const toolItem = {
      id: "gen-t", defId: "030100", code: "030100", stars: 0, name: "Monofluid",
      kind: "tool" as const, rarity: "common" as const, sellValue: 30,
    };
    game.state.economy.inventory.push(generatedWeapon as never, generatedFrame as never, toolItem as never);
    game.save();

    const reloaded = Game.loadOrNew(storage, () => 2000);
    const inv = reloaded.state.economy.inventory;
    expect(inv.find((i) => i.id === "gen-w")).toEqual(generatedWeapon);
    expect(inv.find((i) => i.id === "gen-f")).toEqual(generatedFrame);
    expect(inv.find((i) => i.id === "gen-t")).toEqual(toolItem);
  });
});
