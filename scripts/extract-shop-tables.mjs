/**
 * Extract newserv's BB shop random-set tables into a checked-in engine dataset
 * (shop-table-data spec).
 *
 * Sources:
 *  - system/tables/armor-shop-random-set.json
 *  - system/tables/tool-shop-random-set.json
 *  - system/tables/weapon-shop-random-set-{normal,hard,very-hard,ultimate}.json
 *
 * Mapping constants that live in newserv *code* (not data) are baked in below
 * with file:line provenance so the runtime consumes data only. Regeneration
 * must be byte-identical (shop-tables test).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NEWSERV_ROOT =
  process.argv[2] ?? process.env.NEWSERV_ROOT ?? "/home/psmith/projects/newserv";
const TABLES_DIR = join(NEWSERV_ROOT, "system", "tables");
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "engine", "data");
const OUT_PATH = join(DATA_DIR, "shop-tables.json");

function fail(message) {
  console.error(`extract-shop-tables: ${message}`);
  process.exit(1);
}

function readTable(name) {
  return JSON.parse(readFileSync(join(TABLES_DIR, name), "utf8"));
}

const hexByte = (n) => n.toString(16).padStart(2, "0").toUpperCase();
const weaponCode = (group, index) => `00${hexByte(group)}${hexByte(index)}`;
const toolCode = (group, index) => `03${hexByte(group)}${hexByte(index)}`;

// ---- Constants baked from newserv code ---------------------------------------

// ToolShopRandomSet::item_defs — src/ShopRandomSets.cc:324-341.
// Index used by CommonRecoveryTable/RareRecoveryTable → tool item code.
// 0x0F is the "no item" sentinel (emitted as null).
const TOOL_ITEM_DEFS = [
  toolCode(0x00, 0x00), // 0x00 Monomate
  toolCode(0x00, 0x01), // 0x01 Dimate
  toolCode(0x00, 0x02), // 0x02 Trimate
  toolCode(0x01, 0x00), // 0x03 Monofluid
  toolCode(0x01, 0x01), // 0x04 Difluid
  toolCode(0x01, 0x02), // 0x05 Trifluid
  toolCode(0x06, 0x00), // 0x06 Antidote
  toolCode(0x06, 0x01), // 0x07 Antiparalysis
  toolCode(0x03, 0x00), // 0x08 Sol Atomizer
  toolCode(0x04, 0x00), // 0x09 Moon Atomizer
  toolCode(0x05, 0x00), // 0x0A Star Atomizer
  toolCode(0x07, 0x00), // 0x0B Telepipe
  toolCode(0x08, 0x00), // 0x0C Trap Vision
  toolCode(0x09, 0x00), // 0x0D Scape Doll
  toolCode(0x0a, 0x00), // 0x0E Monogrinder
  null, // 0x0F nothing
];

// ToolShopRandomSet::tech_num_map — src/ShopRandomSets.cc:343-344; names via
// tech_id_to_name (src/StaticGameData.cc:478-480). TechDiskTable entries and
// TechDiskLevelTable columns are in this order.
const TECH_NUM_MAP = [
  { tech: 0x00, name: "Foie" },
  { tech: 0x03, name: "Barta" },
  { tech: 0x06, name: "Zonde" },
  { tech: 0x0f, name: "Resta" },
  { tech: 0x10, name: "Anti" },
  { tech: 0x0d, name: "Shifta" },
  { tech: 0x0a, name: "Deband" },
  { tech: 0x0b, name: "Jellen" },
  { tech: 0x0c, name: "Zalure" },
  { tech: 0x01, name: "Gifoie" },
  { tech: 0x04, name: "Gibarta" },
  { tech: 0x07, name: "Gizonde" },
  { tech: 0x0e, name: "Ryuker" },
  { tech: 0x11, name: "Reverser" },
  { tech: 0x02, name: "Rafoie" },
  { tech: 0x05, name: "Rabarta" },
  { tech: 0x08, name: "Razonde" },
  { tech: 0x09, name: "Grants" },
  { tech: 0x12, name: "Megid" },
];

// WeaponShopRandomSet::type_defs — src/ShopRandomSets.cc:518-591. Weapon type
// code from WeaponTypeWeightTables → (data1[1], data1[2]) → item code. Codes
// 0x39/0x3A are section-ID-dependent (see below); emitted as null here.
const seq = (group, count) => Array.from({ length: count }, (_, i) => weaponCode(group, i));
const WEAPON_TYPE_DEFS = [
  ...seq(0x01, 5), // 0x00-0x04 Saber..Gladius
  ...seq(0x03, 5), // 0x05-0x09 Dagger..Ripper
  ...seq(0x02, 5), // 0x0A-0x0E Sword..Calibur
  ...seq(0x05, 5), // 0x0F-0x13 Slicer..Diska
  ...seq(0x04, 5), // 0x14-0x18 Partisan..Gungnir
  ...seq(0x06, 5), // 0x19-0x1D Handgun..Raygun
  ...seq(0x07, 5), // 0x1E-0x22 Rifle..Laser
  ...seq(0x08, 5), // 0x23-0x27 Mechgun..Vulcan
  ...seq(0x09, 5), // 0x28-0x2C Shot..Arms
  ...seq(0x0a, 4), // 0x2D-0x30 Cane..Club
  ...seq(0x0b, 4), // 0x31-0x34 Rod..Striker
  ...seq(0x0c, 4), // 0x35-0x38 Wand..Scepter
  null, // 0x39 per-section (typeDefs39)
  null, // 0x3A per-section (typeDefs3A)
  weaponCode(0x01, 0x05), // 0x3B DB'S SABER
  weaponCode(0x02, 0x05), // 0x3C FLOWEN'S SWORD
  weaponCode(0x06, 0x05), // 0x3D VARISTA
  weaponCode(0x08, 0x05), // 0x3E M&A60 VISE
  weaponCode(0x0a, 0x04), // 0x3F CLUB OF LACONIUM
  weaponCode(0x0c, 0x04), // 0x40 FIRE SCEPTER:AGNI
  weaponCode(0x0b, 0x04), // 0x41 BATTLE VERGE
  weaponCode(0x01, 0x06), // 0x42 KALADBOLG
  weaponCode(0x03, 0x05), // 0x43 BLADE DANCE
  weaponCode(0x07, 0x05), // 0x44 VISK-235W
  weaponCode(0x0a, 0x05), // 0x45 MACE OF ADAMAN
  weaponCode(0x0c, 0x05), // 0x46 ICE STAFF:DAGON
  weaponCode(0x0b, 0x05), // 0x47 BRAVE HAMMER
];

// Section-ID order everywhere: Viridia, Greenill, Skyly, Bluefull, Purplenum,
// Pinkal, Redria, Oran, Yellowboze, Whitill (docs/newserv-reference.md:36-37).
// type_defs_39 — src/ShopRandomSets.cc:593-605.
const WEAPON_TYPE_DEFS_39 = [
  weaponCode(0x28, 0x00), // Viridia    HARISEN BATTLE FAN
  weaponCode(0x2a, 0x00), // Greenill   AKIKO'S WOK
  weaponCode(0x2b, 0x00), // Skyly      TOY HAMMER
  weaponCode(0x35, 0x00), // Bluefull   CRAZY TUNE
  weaponCode(0x52, 0x00), // Purplenum  FLOWER CANE
  weaponCode(0x48, 0x00), // Pinkal     SAMBA MARACAS
  weaponCode(0x64, 0x00), // Redria     CHAMELEON SCYTHE
  weaponCode(0x59, 0x00), // Oran       BROOM
  weaponCode(0x8a, 0x00), // Yellowboze SANGE
  weaponCode(0x99, 0x00), // Whitill    ANGEL HARP
];
// type_defs_3A — src/ShopRandomSets.cc:607-619.
const WEAPON_TYPE_DEFS_3A = [
  weaponCode(0x99, 0x00), // Viridia    ANGEL HARP
  weaponCode(0x64, 0x00), // Greenill   CHAMELEON SCYTHE
  weaponCode(0x8a, 0x00), // Skyly      SANGE
  weaponCode(0x28, 0x00), // Bluefull   HARISEN BATTLE FAN
  weaponCode(0x59, 0x00), // Purplenum  BROOM
  weaponCode(0x2b, 0x00), // Pinkal     TOY HAMMER
  weaponCode(0x52, 0x00), // Redria     FLOWER CANE
  weaponCode(0x2a, 0x00), // Oran       AKIKO'S WOK
  weaponCode(0x48, 0x00), // Yellowboze SAMBA MARACAS
  weaponCode(0x35, 0x00), // Whitill    CRAZY TUNE
];

// WeaponShopRandomSet::bonus_values — src/ShopRandomSets.cc:621-622.
// BonusRangeTable indexes land here; no zero entry ("no bonus" is type 0).
const BONUS_VALUES = [-50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

// Favored weapon type (data1[1]) per section ID —
// src/TekkerAdjustmentSet.cc:131-145. 0xFF sentinel (no favored type) → null.
const FAVORED_WEAPON_TYPE = [
  0x09, // Viridia    Shot
  0x07, // Greenill   Rifle
  0x02, // Skyly      Sword
  0x04, // Bluefull   Partisan
  0x08, // Purplenum  Mechgun
  0x0a, // Pinkal     Cane
  null, // Redria     none
  0x03, // Oran       Dagger
  null, // Yellowboze none
  0x05, // Whitill    Slicer
];

// ---- Validation --------------------------------------------------------------

function assertLen(name, actual, expected) {
  if (actual !== expected) fail(`${name}: expected length ${expected}, got ${actual}`);
}

// ---- Armor shop --------------------------------------------------------------

const armorRaw = readTable("armor-shop-random-set.json");
for (const key of ["ArmorTable", "ShieldTable", "UnitTable"]) {
  assertLen(`armor ${key} tiers`, armorRaw[key].length, 5);
}

// ---- Tool shop ---------------------------------------------------------------

const toolRaw = readTable("tool-shop-random-set.json");
assertLen("CommonRecoveryTable rows", toolRaw.CommonRecoveryTable.length, 6);
for (const row of toolRaw.CommonRecoveryTable) assertLen("CommonRecoveryTable cols", row.length, 11);
assertLen("RareRecoveryTable rows", toolRaw.RareRecoveryTable.length, 5);
assertLen("TechDiskTable rows", toolRaw.TechDiskTable.length, 5);
assertLen("TechDiskLevelTable rows", toolRaw.TechDiskLevelTable.length, 5);
// Shop tech-disk entries only span techNumMap indexes 0-16 (Grants/Megid are
// never shop stock), so the level table is 17 wide, not 19.
for (const row of toolRaw.TechDiskLevelTable) assertLen("TechDiskLevelTable cols", row.length, 17);
for (const row of toolRaw.TechDiskTable) {
  for (const [entry] of row) {
    if (entry >= toolRaw.TechDiskLevelTable[0].length) {
      fail(`TechDiskTable entry ${entry} outside level-table range`);
    }
  }
}

// ---- Weapon shop (per difficulty) --------------------------------------------

const WEAPON_FILES = {
  Normal: "weapon-shop-random-set-normal.json",
  Hard: "weapon-shop-random-set-hard.json",
  VeryHard: "weapon-shop-random-set-very-hard.json",
  Ultimate: "weapon-shop-random-set-ultimate.json",
};
const WEAPON_TIER_COUNT = { Normal: 5, Hard: 5, VeryHard: 5, Ultimate: 7 };

const weapon = {};
for (const [difficulty, file] of Object.entries(WEAPON_FILES)) {
  const raw = readTable(file);
  assertLen(`${file} WeaponTypeWeightTables tiers`, raw.WeaponTypeWeightTables.length, WEAPON_TIER_COUNT[difficulty]);
  for (const tier of raw.WeaponTypeWeightTables) {
    assertLen(`${file} WeaponTypeWeightTables sections`, tier.length, 10);
  }
  assertLen(`${file} BonusTypeTable1 tiers`, raw.BonusTypeTable1.length, 9);
  assertLen(`${file} BonusTypeTable2 tiers`, raw.BonusTypeTable2.length, 9);
  assertLen(`${file} BonusRangeTable1 tiers`, raw.BonusRangeTable1.length, 9);
  assertLen(`${file} BonusRangeTable2 tiers`, raw.BonusRangeTable2.length, 9);
  assertLen(`${file} SpecialModeTable tiers`, raw.SpecialModeTable.length, 8);
  assertLen(`${file} DefaultDringRangeTable tiers`, raw.DefaultDringRangeTable.length, 6);
  assertLen(`${file} FavoredDringRangeTable tiers`, raw.FavoredDringRangeTable.length, 6);
  weapon[difficulty] = {
    // [tier][sectionId] list of [weaponTypeCode, weight]
    typeWeightTables: raw.WeaponTypeWeightTables,
    bonusTypeTable1: raw.BonusTypeTable1,
    bonusTypeTable2: raw.BonusTypeTable2,
    bonusRangeTable1: raw.BonusRangeTable1,
    bonusRangeTable2: raw.BonusRangeTable2,
    specialModeTable: raw.SpecialModeTable,
    // "Dring" preserves the source tables' historical typo for "grind".
    defaultGrindRangeTable: raw.DefaultDringRangeTable,
    favoredGrindRangeTable: raw.FavoredDringRangeTable,
  };
}

// ---- Output ------------------------------------------------------------------

const out = {
  source:
    "newserv/system/tables/{armor,tool}-shop-random-set.json + weapon-shop-random-set-{normal,hard,very-hard,ultimate}.json",
  constantsSource:
    "newserv/src/ShopRandomSets.cc (item_defs :324-341, tech_num_map :343-344, type_defs :518-619, bonus_values :621-622), newserv/src/TekkerAdjustmentSet.cc:131-145",
  sectionIds: [
    "Viridia",
    "Greenill",
    "Skyly",
    "Bluefull",
    "Purplenum",
    "Pinkal",
    "Redria",
    "Oran",
    "Yellowboze",
    "Whitill",
  ],
  armor: {
    // [tier 0-4] list of [subtype data1[2], weight]
    armorTable: armorRaw.ArmorTable,
    shieldTable: armorRaw.ShieldTable,
    // [tier 0-4] list of [unit type id data1[2], weight]
    unitTable: armorRaw.UnitTable,
  },
  tool: {
    itemDefs: TOOL_ITEM_DEFS,
    techNumMap: TECH_NUM_MAP,
    // [tier 0-5] fixed rows of itemDefs indexes (0x0F = skip)
    commonRecoveryTable: toolRaw.CommonRecoveryTable,
    // [tier 0-4] list of [itemDefs index, weight] (index 15 = Nothing)
    rareRecoveryTable: toolRaw.RareRecoveryTable,
    // [tier 0-4] list of [techNumMap index, weight]
    techDiskTable: toolRaw.TechDiskTable,
    // [tier 0-4][techNumMap index] level mode: {} = level 1,
    // {PlayerLevelDivisor} or {MinLevel, MaxLevel}
    techDiskLevelTable: toolRaw.TechDiskLevelTable,
  },
  weapon,
  weaponTypeDefs: WEAPON_TYPE_DEFS,
  weaponTypeDefs39: WEAPON_TYPE_DEFS_39,
  weaponTypeDefs3A: WEAPON_TYPE_DEFS_3A,
  bonusValues: BONUS_VALUES,
  favoredWeaponType: FAVORED_WEAPON_TYPE,
};

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${OUT_PATH}`);
