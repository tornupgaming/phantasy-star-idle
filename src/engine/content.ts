/**
 * Authored game content (task 4.3; drop-table data for task 6).
 *
 * Gear templates, drop tables (with difficulty tiers), enemy definitions, and
 * areas. Nothing here is random; drop *selection* happens at runtime through the
 * seeded RNG (loot.ts). The curated GEAR templates below remain the circulating
 * item set; the authentic BB item definitions live in data/item-table.ts
 * (item-parameter-data spec) and enter circulation with the drop-table port.
 */

import { KIND_FOR_ARCHETYPE, type WeaponType } from "./items";
import type { GearTemplate, DropTable } from "./loot";
import type { EnemyDef } from "./enemies";
import type { AreaDef } from "./areas";
import type { Stats } from "./stats";
import { emptyEquipment, type Character } from "./character";
import { sectionIdFromName } from "./progression";
import type { EconomyState } from "./loot";
import type { Supply } from "./consumables";

// ---- Gear templates ----------------------------------------------------------

function weapon(
  defId: string,
  name: string,
  weaponType: WeaponType,
  minAtp: number,
  spread: number,
  ata: number,
  attribute: number,
  rarity: GearTemplate["rarity"],
  sellValue: number,
  maxGrind = 5,
): GearTemplate {
  return {
    kind: "weapon",
    defId,
    name,
    weaponType,
    weaponKind: KIND_FOR_ARCHETYPE[weaponType],
    minAtp,
    spread,
    attribute,
    ata,
    grind: 0,
    maxGrind,
    rarity,
    sellValue,
  };
}

function frame(
  defId: string,
  name: string,
  dfp: number,
  evp: number,
  unitSlots: number,
  rarity: GearTemplate["rarity"],
  sellValue: number,
): GearTemplate {
  return { kind: "frame", defId, name, dfp, evp, unitSlots, rarity, sellValue };
}

function barrier(
  defId: string,
  name: string,
  dfp: number,
  evp: number,
  rarity: GearTemplate["rarity"],
  sellValue: number,
): GearTemplate {
  return { kind: "barrier", defId, name, dfp, evp, rarity, sellValue };
}

function unit(
  defId: string,
  name: string,
  bonus: Partial<Stats>,
  rarity: GearTemplate["rarity"],
  sellValue: number,
): GearTemplate {
  return { kind: "unit", defId, name, bonus, rarity, sellValue };
}

export const GEAR = {
  // weapons
  handBlade: weapon("hand-blade", "Hand Blade", "saber", 42, 18, 38, 0.05, "common", 40),
  ironSaber: weapon("iron-saber", "Iron Saber", "saber", 55, 25, 40, 0.1, "uncommon", 120),
  greatBlade: weapon("great-blade", "Great Blade", "sword", 110, 60, 25, 0.15, "uncommon", 220),
  scoutRifle: weapon("scout-rifle", "Scout Rifle", "rifle", 70, 30, 70, 0.1, "uncommon", 200),
  photonEdge: weapon("photon-edge", "Photon Edge", "saber", 130, 55, 60, 0.35, "rare", 900, 9),
  // frames
  clothArmor: frame("cloth-armor", "Cloth Armor", 12, 6, 1, "common", 30),
  plateArmor: frame("plate-armor", "Plate Armor", 40, 10, 2, "uncommon", 140),
  guardianFrame: frame("guardian-frame", "Guardian Frame", 85, 30, 4, "rare", 800),
  // barriers
  woodShield: barrier("wood-shield", "Wood Shield", 8, 8, "common", 25),
  aegisBarrier: barrier("aegis-barrier", "Aegis Barrier", 35, 25, "rare", 600),
  // units
  powerUnit: unit("power-unit", "Power Unit", { atp: 25 }, "uncommon", 150),
  guardUnit: unit("guard-unit", "Guard Unit", { dfp: 20 }, "uncommon", 150),
  hitUnit: unit("hit-unit", "Hit Unit", { ata: 20 }, "uncommon", 150),
  vitalityUnit: unit("vitality-unit", "Vitality Unit", { hp: 60 }, "rare", 400),
} satisfies Record<string, GearTemplate>;

// ---- Drop tables -------------------------------------------------------------

const drop = {
  nothing: (weight: number) => ({ weight, spec: { kind: "nothing" as const } }),
  meseta: (weight: number, min: number, max: number) => ({
    weight,
    spec: { kind: "meseta" as const, min, max },
  }),
  gear: (weight: number, template: GearTemplate) => ({
    weight,
    spec: { kind: "gear" as const, template },
  }),
  heal: (weight: number, id: "monomate" | "dimate" | "trimate", min: number, max: number) => ({
    weight,
    spec: { kind: "consumable" as const, id, min, max },
  }),
  revive: (weight: number, min: number, max: number) => ({
    weight,
    spec: { kind: "consumable" as const, id: "moon-atomizer" as const, min, max },
  }),
  grinder: (weight: number, min: number, max: number) => ({
    weight,
    spec: { kind: "grinder" as const, min, max },
  }),
};

export const DROP_TABLES: Record<string, DropTable> = {
  "forest-enemies": {
    id: "forest-enemies",
    tiers: [
      [drop.nothing(45), drop.meseta(35, 10, 40), drop.heal(12, "monomate", 1, 1), drop.gear(6, GEAR.handBlade), drop.gear(2, GEAR.clothArmor)],
      [drop.nothing(35), drop.meseta(35, 40, 120), drop.heal(12, "dimate", 1, 1), drop.gear(10, GEAR.ironSaber), drop.gear(6, GEAR.powerUnit), drop.grinder(2, 1, 1)],
      [drop.nothing(25), drop.meseta(30, 200, 500), drop.heal(12, "trimate", 1, 2), drop.gear(20, GEAR.photonEdge), drop.gear(11, GEAR.guardianFrame), drop.grinder(2, 1, 2)],
    ],
  },
  "caves-enemies": {
    id: "caves-enemies",
    tiers: [
      [drop.nothing(40), drop.meseta(35, 30, 80), drop.heal(12, "monomate", 1, 2), drop.gear(9, GEAR.ironSaber), drop.gear(4, GEAR.plateArmor)],
      [drop.nothing(32), drop.meseta(33, 80, 220), drop.heal(12, "dimate", 1, 2), drop.gear(12, GEAR.greatBlade), drop.gear(8, GEAR.guardUnit), drop.grinder(3, 1, 2)],
      [drop.nothing(22), drop.meseta(28, 300, 700), drop.heal(12, "trimate", 1, 2), drop.gear(22, GEAR.photonEdge), drop.gear(12, GEAR.aegisBarrier), drop.grinder(4, 1, 3)],
    ],
  },
  "mines-enemies": {
    id: "mines-enemies",
    tiers: [
      [drop.nothing(38), drop.meseta(34, 50, 120), drop.heal(12, "dimate", 1, 1), drop.gear(10, GEAR.scoutRifle), drop.gear(6, GEAR.plateArmor)],
      [drop.nothing(30), drop.meseta(32, 120, 300), drop.heal(12, "dimate", 1, 3), drop.gear(14, GEAR.greatBlade), drop.gear(9, GEAR.hitUnit), drop.grinder(3, 1, 2)],
      [drop.nothing(20), drop.meseta(26, 400, 900), drop.heal(12, "trimate", 2, 3), drop.gear(24, GEAR.photonEdge), drop.gear(14, GEAR.vitalityUnit), drop.grinder(4, 2, 3)],
    ],
  },
  "boss-drops": {
    id: "boss-drops",
    tiers: [
      [drop.meseta(50, 100, 300), drop.gear(30, GEAR.photonEdge), drop.gear(20, GEAR.guardianFrame)],
      [drop.meseta(40, 300, 700), drop.gear(35, GEAR.photonEdge), drop.gear(25, GEAR.aegisBarrier)],
      [drop.meseta(30, 800, 1800), drop.gear(40, GEAR.photonEdge), drop.gear(30, GEAR.vitalityUnit)],
    ],
  },
  "box-common": {
    id: "box-common",
    tiers: [
      [drop.nothing(20), drop.meseta(45, 20, 80), drop.heal(20, "monomate", 1, 2), drop.grinder(10, 1, 1), drop.revive(5, 1, 1)],
      [drop.nothing(15), drop.meseta(40, 80, 200), drop.heal(20, "dimate", 1, 2), drop.grinder(15, 1, 2), drop.revive(10, 1, 1)],
      [drop.nothing(10), drop.meseta(35, 250, 600), drop.heal(20, "trimate", 1, 2), drop.grinder(20, 2, 3), drop.revive(15, 1, 2)],
    ],
  },
};

// ---- Enemies -----------------------------------------------------------------

// Stats (HP/ATP/DFP/ATA/EVP/LCK, XP, meseta) come from the generated authentic
// dataset (src/engine/data/enemy-stats.json) keyed by `statsType`; difficulty
// selects the row at run time. Only the hand-authored "feel" fields live here.
function enemy(
  id: string,
  statsType: string,
  enemyType: EnemyDef["enemyType"],
  spread: number,
  pvarMax: number,
  dropTableId: string,
): EnemyDef {
  return { id, statsType, episode: "1", enemyType, spread, pvarMax, dropTableId };
}

// The roster covers every type the wired floors' free-play layouts can spawn
// (see stage-gen.ts), plus the rare variants the stage generator can roll
// (Rag Rappy → Al Rappy, Poison Lily → Nar Lily).
export const ENEMIES: Record<string, EnemyDef> = {
  // Forest 1
  booma: enemy("booma", "BOOMA", "grunt", 12, 4, "forest-enemies"),
  gobooma: enemy("gobooma", "GOBOOMA", "grunt", 13, 5, "forest-enemies"),
  gigobooma: enemy("gigobooma", "GIGOBOOMA", "grunt", 14, 5, "forest-enemies"),
  ragRappy: enemy("rag-rappy", "RAG_RAPPY", "grunt", 10, 3, "forest-enemies"),
  alRappy: enemy("al-rappy", "AL_RAPPY", "grunt", 10, 3, "forest-enemies"),
  savageWolf: enemy("savage-wolf", "SAVAGE_WOLF", "beast", 12, 4, "forest-enemies"),
  barbarousWolf: enemy("barbarous-wolf", "BARBAROUS_WOLF", "beast", 13, 5, "forest-enemies"),
  monest: enemy("monest", "MONEST", "grunt", 0, 0, "forest-enemies"),
  mothmant: enemy("mothmant", "MOTHMANT", "flyer", 8, 2, "forest-enemies"),
  // Cave 1
  evilShark: enemy("evil-shark", "EVIL_SHARK", "beast", 22, 8, "caves-enemies"),
  palShark: enemy("pal-shark", "PAL_SHARK", "beast", 22, 8, "caves-enemies"),
  guilShark: enemy("guil-shark", "GUIL_SHARK", "beast", 24, 9, "caves-enemies"),
  poisonLily: enemy("poison-lily", "POISON_LILY", "flyer", 18, 8, "caves-enemies"),
  narLily: enemy("nar-lily", "NAR_LILY", "flyer", 18, 8, "caves-enemies"),
  grassAssassin: enemy("grass-assassin", "GRASS_ASSASSIN", "beast", 24, 9, "caves-enemies"),
  nanoDragon: enemy("nano-dragon", "NANO_DRAGON", "flyer", 20, 8, "caves-enemies"),
  panArms: enemy("pan-arms", "PAN_ARMS", "grunt", 26, 9, "caves-enemies"),
  hidoom: enemy("hidoom", "HIDOOM", "grunt", 22, 8, "caves-enemies"),
  migium: enemy("migium", "MIGIUM", "grunt", 22, 8, "caves-enemies"),
  // Mine 1
  gillchic: enemy("gillchic", "GILLCHIC", "grunt", 28, 10, "mines-enemies"),
  canadine: enemy("canadine", "CANADINE", "flyer", 22, 8, "mines-enemies"),
  canadineGroup: enemy("canadine-group", "CANADINE_GROUP", "flyer", 22, 8, "mines-enemies"),
  canane: enemy("canane", "CANANE", "flyer", 24, 9, "mines-enemies"),
  sinowBeat: enemy("sinow-beat", "SINOW_BEAT", "beast", 26, 9, "mines-enemies"),
  sinowGold: enemy("sinow-gold", "SINOW_GOLD", "beast", 28, 10, "mines-enemies"),
  // Bosses
  dragon: enemy("dragon", "DRAGON", "boss", 40, 15, "boss-drops"),
};

const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(
  Object.values(ENEMIES).map((e) => [e.id, e]),
);

/** Reverse lookup: dataset stats type ("BOOMA") → roster definition. */
const ENEMY_BY_STATS_TYPE: Record<string, EnemyDef> = Object.fromEntries(
  Object.values(ENEMIES).map((e) => [e.statsType, e]),
);

export function getEnemyDef(id: string): EnemyDef {
  const def = ENEMY_BY_ID[id];
  if (!def) throw new Error(`unknown enemy: ${id}`);
  return def;
}

export function enemyDefForStatsType(statsType: string): EnemyDef | null {
  return ENEMY_BY_STATS_TYPE[statsType] ?? null;
}

export function getDropTable(id: string): DropTable {
  const t = DROP_TABLES[id];
  if (!t) throw new Error(`unknown drop table: ${id}`);
  return t;
}

// ---- Areas -------------------------------------------------------------------

// Each area wires to a PSO Ep1 floor; the per-run room list is generated by
// stage-gen.ts from one of the floor's authentic free-play spawn layouts
// (map-spawns.json). Progression targets (against the authentic BB curves in
// classes.ts): forest suits a fresh level-1 character with starter gear,
// caves ~level 12, mines ~level 22, the Dragon ~level 30.
export const AREAS: Record<string, AreaDef> = {
  forest: {
    id: "forest",
    name: "Verdant Forest",
    recommendedAtp: 80,
    episode: "1",
    floor: 1, // Forest 1
    boxDropTableId: "box-common",
  },
  caves: {
    id: "caves",
    name: "Sunken Caves",
    recommendedAtp: 170,
    episode: "1",
    floor: 3, // Cave 1
    boxDropTableId: "box-common",
  },
  mines: {
    id: "mines",
    name: "Ruined Mines",
    recommendedAtp: 300,
    episode: "1",
    floor: 6, // Mine 1
    bossFloor: 11, // Under the Dome (Dragon)
    boxDropTableId: "box-common",
  },
};

export function getArea(id: string): AreaDef {
  const a = AREAS[id];
  if (!a) throw new Error(`unknown area: ${id}`);
  return a;
}

export const AREA_LIST: AreaDef[] = [AREAS.forest, AREAS.caves, AREAS.mines];

// ---- New-game starting state -------------------------------------------------

export function startingCharacter(): Character {
  const name = "Hunter";
  return {
    id: "char-1",
    name,
    classId: "humar",
    sectionId: sectionIdFromName(name),
    level: 1,
    xp: 0,
    equipment: emptyEquipment(),
  };
}

export function startingEconomy(): EconomyState {
  // Start with basic starter gear in the inventory so the first run is winnable.
  return {
    meseta: 300,
    grinders: 2,
    inventory: [
      { ...GEAR.handBlade, id: "start-weapon" },
      { ...GEAR.clothArmor, id: "start-frame" },
      { ...GEAR.woodShield, id: "start-barrier" },
    ] as EconomyState["inventory"],
  };
}

export function startingSupply(): Supply {
  // The starter med-pack is the survivability knob (enemy stats are never
  // tuned). Authentic Forest 1 layouts run ~30 rooms and XP applies only at
  // settle, so a level-1 character (20 HP vs ATP-85 wolves) heals through
  // nearly every hit; the pack plus mid-run heal pickups must cover a full
  // clear. The moon atomizers absorb crit spikes no heal threshold prevents.
  return { monomate: 40, "moon-atomizer": 3 };
}
