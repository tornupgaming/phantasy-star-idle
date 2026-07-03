/**
 * Authored game content (task 4.3; drop-table data for task 6).
 *
 * Enemy definitions, areas, and new-game starter state. Nothing here is random;
 * drops are generated at runtime through the seeded authentic generator.
 */

import type { EnemyDef } from "./enemies";
import type { AreaDef } from "./areas";
import { emptyEquipment, type Character } from "./character";
import { sectionIdFromName } from "./progression";
import type { EconomyState, GearTemplate } from "./loot";
import type { Supply } from "./consumables";
import { templateFromCode } from "./data/item-table";

// ---- Compatibility gear fixtures ---------------------------------------------

/**
 * Curated template from an authentic item code, with equip requirements
 * stripped: starter/shop/test gear always equips (character-equipment spec —
 * requirement gating applies to drop-generated items, which keep the authentic
 * `requirements` from templateFromCode).
 */
function curated(code: string, over: { rarity?: GearTemplate["rarity"] } = {}): GearTemplate {
  const t = { ...templateFromCode(code), ...over } as GearTemplate;
  delete t.requirements;
  return t;
}

/** Authentic item-table templates used for starter state, shops, and legacy tests. */
export const GEAR = {
  handBlade: curated("000100"), // Saber, 40-55 ATP
  ironSaber: curated("000101"), // Brand, 80-100 ATP
  greatBlade: curated("000202"), // Breaker (sword), 100-150 ATP
  scoutRifle: curated("000701"), // Sniper (rifle), 50-90 ATP
  photonEdge: curated("000103", { rarity: "rare" as const }), // Pallasch, 170-220 ATP
  clothArmor: curated("010100"), // Frame
  plateArmor: curated("010104"), // Soul Frame
  guardianFrame: curated("010104", { rarity: "rare" as const }),
  woodShield: curated("010200"), // Barrier
  aegisBarrier: curated("010203", { rarity: "rare" as const }), // Giga Shield
  powerUnit: curated("010301"),
  guardUnit: curated("010302"),
  hitUnit: curated("01030A"),
  vitalityUnit: curated("010312", { rarity: "rare" as const }),
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
): EnemyDef {
  return { id, statsType, episode: "1", enemyType, spread, pvarMax };
}

// The roster covers every type the wired floors' free-play layouts can spawn
// (see stage-gen.ts), plus the rare variants the stage generator can roll
// (Rag Rappy → Al Rappy, Poison Lily → Nar Lily).
export const ENEMIES: Record<string, EnemyDef> = {
  // Forest 1
  booma: enemy("booma", "BOOMA", "grunt", 12, 4),
  gobooma: enemy("gobooma", "GOBOOMA", "grunt", 13, 5),
  gigobooma: enemy("gigobooma", "GIGOBOOMA", "grunt", 14, 5),
  ragRappy: enemy("rag-rappy", "RAG_RAPPY", "grunt", 10, 3),
  alRappy: enemy("al-rappy", "AL_RAPPY", "grunt", 10, 3),
  savageWolf: enemy("savage-wolf", "SAVAGE_WOLF", "beast", 12, 4),
  barbarousWolf: enemy("barbarous-wolf", "BARBAROUS_WOLF", "beast", 13, 5),
  monest: enemy("monest", "MONEST", "grunt", 0, 0),
  mothmant: enemy("mothmant", "MOTHMANT", "flyer", 8, 2),
  // Cave 1
  evilShark: enemy("evil-shark", "EVIL_SHARK", "beast", 22, 8),
  palShark: enemy("pal-shark", "PAL_SHARK", "beast", 22, 8),
  guilShark: enemy("guil-shark", "GUIL_SHARK", "beast", 24, 9),
  poisonLily: enemy("poison-lily", "POISON_LILY", "flyer", 18, 8),
  narLily: enemy("nar-lily", "NAR_LILY", "flyer", 18, 8),
  grassAssassin: enemy("grass-assassin", "GRASS_ASSASSIN", "beast", 24, 9),
  nanoDragon: enemy("nano-dragon", "NANO_DRAGON", "flyer", 20, 8),
  panArms: enemy("pan-arms", "PAN_ARMS", "grunt", 26, 9),
  hidoom: enemy("hidoom", "HIDOOM", "grunt", 22, 8),
  migium: enemy("migium", "MIGIUM", "grunt", 22, 8),
  // Mine 1
  gillchic: enemy("gillchic", "GILLCHIC", "grunt", 28, 10),
  canadine: enemy("canadine", "CANADINE", "flyer", 22, 8),
  canadineGroup: enemy("canadine-group", "CANADINE_GROUP", "flyer", 22, 8),
  canane: enemy("canane", "CANANE", "flyer", 24, 9),
  sinowBeat: enemy("sinow-beat", "SINOW_BEAT", "beast", 26, 9),
  sinowGold: enemy("sinow-gold", "SINOW_GOLD", "beast", 28, 10),
  // Bosses
  dragon: enemy("dragon", "DRAGON", "boss", 40, 15),
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
  },
  caves: {
    id: "caves",
    name: "Sunken Caves",
    recommendedAtp: 170,
    episode: "1",
    floor: 3, // Cave 1
  },
  mines: {
    id: "mines",
    name: "Ruined Mines",
    recommendedAtp: 300,
    episode: "1",
    floor: 6, // Mine 1
    bossFloor: 11, // Under the Dome (Dragon)
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
  // nearly every hit; the pack must cover a full clear on its own — authentic
  // drop generation yields under one mate pickup per run (vs ~6 from the old
  // hand-authored tables). The moon atomizers absorb crit spikes no heal
  // threshold prevents. Sized for a 100% clear rate over 50 seeded runs.
  return { monomate: 60, "moon-atomizer": 5 };
}
