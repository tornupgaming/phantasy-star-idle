/**
 * Extracts authentic PSO Blue Burst free-play map spawn data from a local
 * newserv clone into src/engine/data/map-spawns.json.
 *
 * Sources (read-only, extraction time only), all under <newserv>/system/maps/bb-v4/:
 *   SetDataTableOn.rel / SetDataTableOff.rel — per-area variation tables:
 *       area -> layout variation -> entity variation -> map file basename.
 *       Format implemented by SetDataTable::load_table_t in src/Map.cc.
 *       The *Ulti.rel tables are byte-different but content-identical for the
 *       areas they cover (they just omit Episode 4), so they are not read.
 *   map_*e.dat — free-play enemy set files: raw arrays of 0x48-byte
 *       EnemySetEntry structs (src/Map.hh). No section headers (those exist
 *       only in quest DAT files).
 *
 * The EnemySetEntry -> concrete enemy expansion (base_type + params -> enemy
 * type, children like Monest's Mothmants, rare flags) is a direct port of
 * SuperMap::add_enemy_and_children in <newserv>/src/Map.cc. Enemy type names
 * match the EnemyType enum, i.e. the keys of enemy-stats.json.
 *
 * Usage: node scripts/extract-map-spawns.mjs [newserv-root]
 *        (or NEWSERV_ROOT env var; defaults to /home/psmith/projects/newserv)
 *
 * The output is deterministic: fixed iteration order, fixed field order,
 * 2-space indent. Regenerating against the same clone must be byte-identical.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NEWSERV_ROOT =
  process.argv[2] ?? process.env.NEWSERV_ROOT ?? "/home/psmith/projects/newserv";
const MAPS_DIR = join(NEWSERV_ROOT, "system", "maps", "bb-v4");
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "engine", "data");
const OUT_PATH = join(DATA_DIR, "map-spawns.json");

const ENEMY_SET_ENTRY_SIZE = 0x48;

function fail(msg) {
  console.error(`extract-map-spawns: ${msg}`);
  console.error("No output written.");
  process.exit(1);
}

const warnings = [];
function warn(msg) {
  warnings.push(msg);
}

// ---- Area table -----------------------------------------------------------------
//
// Area numbers, floor numbers, and display names follow newserv's
// SetDataTableBase::default_floor_to_area (src/Map.cc) and the FloorDefinition
// table (src/StaticGameData.cc). Non-combat areas (cities, lobby, battle-mode
// arenas, the Ep4 test map) are intentionally omitted.

const AREAS = [
  // Episode 1
  { area: 0x01, episode: "1", floor: 1, name: "Forest 1" },
  { area: 0x02, episode: "1", floor: 2, name: "Forest 2" },
  { area: 0x03, episode: "1", floor: 3, name: "Cave 1" },
  { area: 0x04, episode: "1", floor: 4, name: "Cave 2" },
  { area: 0x05, episode: "1", floor: 5, name: "Cave 3" },
  { area: 0x06, episode: "1", floor: 6, name: "Mine 1" },
  { area: 0x07, episode: "1", floor: 7, name: "Mine 2" },
  { area: 0x08, episode: "1", floor: 8, name: "Ruins 1" },
  { area: 0x09, episode: "1", floor: 9, name: "Ruins 2" },
  { area: 0x0a, episode: "1", floor: 10, name: "Ruins 3" },
  { area: 0x0b, episode: "1", floor: 11, name: "Under the Dome (Dragon)", boss: true },
  { area: 0x0c, episode: "1", floor: 12, name: "Underground Channel (De Rol Le)", boss: true },
  { area: 0x0d, episode: "1", floor: 13, name: "Monitor Room (Vol Opt)", boss: true },
  { area: 0x0e, episode: "1", floor: 14, name: "???? (Dark Falz)", boss: true },
  // Episode 2
  { area: 0x13, episode: "2", floor: 1, name: "VR Temple Alpha" },
  { area: 0x14, episode: "2", floor: 2, name: "VR Temple Beta" },
  { area: 0x15, episode: "2", floor: 3, name: "VR Spaceship Alpha" },
  { area: 0x16, episode: "2", floor: 4, name: "VR Spaceship Beta" },
  { area: 0x17, episode: "2", floor: 5, name: "Central Control Area" },
  { area: 0x18, episode: "2", floor: 6, name: "Jungle Area North" },
  { area: 0x19, episode: "2", floor: 7, name: "Jungle Area East" },
  { area: 0x1a, episode: "2", floor: 8, name: "Mountain Area" },
  { area: 0x1b, episode: "2", floor: 9, name: "Seaside Area" },
  { area: 0x1c, episode: "2", floor: 10, name: "Seabed Upper Levels" },
  { area: 0x1d, episode: "2", floor: 11, name: "Seabed Lower Levels" },
  { area: 0x1e, episode: "2", floor: 12, name: "Cliffs of Gal Da Val (Gal Gryphon)", boss: true },
  { area: 0x1f, episode: "2", floor: 13, name: "Test Subject Disposal Area (Olga Flow)", boss: true },
  { area: 0x20, episode: "2", floor: 14, name: "VR Temple Final (Barba Ray)", boss: true },
  { area: 0x21, episode: "2", floor: 15, name: "VR Spaceship Final (Gol Dragon)", boss: true },
  { area: 0x22, episode: "2", floor: 16, name: "Seaside Area (night)" },
  { area: 0x23, episode: "2", floor: 17, name: "Control Tower" },
  // Episode 4
  { area: 0x24, episode: "4", floor: 1, name: "Crater (Eastern Route)" },
  { area: 0x25, episode: "4", floor: 2, name: "Crater (Western Route)" },
  { area: 0x26, episode: "4", floor: 3, name: "Crater (Southern Route)" },
  { area: 0x27, episode: "4", floor: 4, name: "Crater (Northern Route)" },
  { area: 0x28, episode: "4", floor: 5, name: "Crater Interior" },
  { area: 0x29, episode: "4", floor: 6, name: "Subterranean Desert 1" },
  { area: 0x2a, episode: "4", floor: 7, name: "Subterranean Desert 2" },
  { area: 0x2b, episode: "4", floor: 8, name: "Subterranean Desert 3" },
  { area: 0x2c, episode: "4", floor: 9, name: "Meteor Impact Site (Saint-Milion)", boss: true },
];

// Free-play variation caps: how many of the available variations the game
// actually rolls in free play (SetDataTable::num_free_play_variations_for_floor
// in src/Map.cc). [layout, entities] pairs indexed by area number.
// prettier-ignore
const FREE_PLAY_COUNTS_ONLINE = [
  // Episode 1 (00-11): P2, F1, F2, C1, C2, C3, M1, M2, R1, R2, R3, Dragon, DeRolLe, VolOpt, Falz, Lobby, VS1, VS2
  [1, 1], [1, 5], [1, 5], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],
  [1, 1], [1, 1], [1, 1], [1, 1], [10, 1], [1, 1], [1, 1],
  // Episode 2 (12-23): Lab, VRTA, VRTB, VRSA, VRSB, CCA, JN, JE, Mtn, Seaside, SBU, SBL, GalGryphon, OlgaFlow, BarbaRay, GolDragon, SeasideNight, Tower
  [1, 1], [2, 1], [2, 1], [2, 1], [2, 1], [1, 3], [1, 3], [1, 3], [2, 2], [1, 3], [2, 2], [2, 2],
  [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1],
  // Episode 4 (24-2E): CE, CW, CS, CN, CI, D1, D2, D3, SaintMilion, P2, Test
  [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [3, 1], [1, 3], [3, 1], [1, 1], [1, 1], [1, 1],
];
// prettier-ignore
const FREE_PLAY_COUNTS_OFFLINE = [
  [1, 1], [1, 3], [1, 3], [3, 1], [3, 1], [3, 1], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],
  [1, 1], [1, 1], [1, 1], [1, 1], [10, 1], [1, 1], [1, 1],
  [1, 1], [2, 1], [2, 1], [2, 1], [2, 1], [1, 3], [1, 3], [1, 3], [2, 2], [1, 3], [2, 1], [2, 1],
  [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1],
  [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [3, 1], [1, 3], [3, 1], [1, 1], [1, 1], [1, 1],
];

// Rare-variant mapping (EnemyTypeDefinition::rare_type in src/EnemyType.cc),
// used to resolve set entries whose params force the rare variant. The same
// mapping is exposed to the game by src/engine/data/map-spawns.ts for
// server-style random rare rolls. Ep2 Rag Rappy's rare form is
// event-dependent (Saint/Egg/Hallo Rappy during seasonal lobby events);
// LOVE_RAPPY is the no-event value.
function rareTypeFor(type, area) {
  switch (type) {
    case "HILDEBEAR":
      return "HILDEBLUE";
    case "RAG_RAPPY":
      return area < 0x12 ? "AL_RAPPY" : "LOVE_RAPPY";
    case "POISON_LILY":
      return "NAR_LILY";
    case "POFUILLY_SLIME":
      return "POUILLY_SLIME";
    case "SAND_RAPPY_CRATER":
      return "DEL_RAPPY_CRATER";
    case "SAND_RAPPY_DESERT":
      return "DEL_RAPPY_DESERT";
    case "MERISSA_A":
      return "MERISSA_AA";
    case "ZU_CRATER":
      return "PAZUZU_CRATER";
    case "ZU_DESERT":
      return "PAZUZU_DESERT";
    case "DORPHON":
      return "DORPHON_ECLAIR";
    case "SAINT_MILION":
    case "SHAMBERTIN":
      return "KONDRIEU";
    default:
      return null;
  }
}

// ---- SetDataTable*.rel parsing ---------------------------------------------------
//
// REL layout (little-endian on BB): a 32-byte footer at the end of the file
// holds root_offset at +0x10 (RELFileFooterT in src/CommonFileFormats.hh).
// root_offset points at a u32 giving the start of the root table, which runs
// up to root_offset itself. Root entries are (offset, count) pairs per area;
// each points to (offset, count) pairs per layout; each of those points to
// 12-byte entity entries holding three c-string offsets:
// object basename, enemy/event basename, area setup filename.

function parseSetDataTable(path) {
  const buf = readFileSync(path);
  if (buf.length < 32) fail(`${path}: too small to contain a REL footer`);
  const u32 = (off) => buf.readUInt32LE(off);
  const cstr = (off) => {
    let end = off;
    while (end < buf.length && buf[end] !== 0) end++;
    return buf.toString("latin1", off, end);
  };
  const rootOffset = u32(buf.length - 32 + 16);
  const rootTableOffset = u32(rootOffset);
  const areas = [];
  for (let p = rootTableOffset; p < rootOffset; p += 8) {
    const layoutTableOffset = u32(p);
    const layoutCount = u32(p + 4);
    const layouts = [];
    for (let l = 0; l < layoutCount; l++) {
      const entitiesTableOffset = u32(layoutTableOffset + l * 8);
      const entitiesCount = u32(layoutTableOffset + l * 8 + 4);
      const entities = [];
      for (let e = 0; e < entitiesCount; e++) {
        const base = entitiesTableOffset + e * 12;
        entities.push({
          objectBasename: cstr(u32(base)),
          enemyBasename: cstr(u32(base + 4)),
          setupFilename: cstr(u32(base + 8)),
        });
      }
      layouts.push(entities);
    }
    areas.push(layouts);
  }
  return areas;
}

// ---- Enemy set (e.dat) parsing ----------------------------------------------------

function parseEnemySets(path) {
  const buf = readFileSync(path);
  if (buf.length % ENEMY_SET_ENTRY_SIZE !== 0) {
    fail(`${path}: size ${buf.length} is not a multiple of 0x48 — not a free-play enemy set file?`);
  }
  const sets = [];
  for (let off = 0; off < buf.length; off += ENEMY_SET_ENTRY_SIZE) {
    sets.push({
      baseType: buf.readUInt16LE(off + 0x00),
      numChildren: buf.readUInt16LE(off + 0x06),
      floor: buf.readUInt16LE(off + 0x08),
      room: buf.readUInt16LE(off + 0x0c),
      wave: buf.readUInt16LE(off + 0x0e),
      param1: buf.readFloatLE(off + 0x2c),
      param2: buf.readFloatLE(off + 0x30),
      param3: buf.readFloatLE(off + 0x34),
      param4: buf.readFloatLE(off + 0x38),
      param5: buf.readFloatLE(off + 0x3c),
      param6: buf.readInt16LE(off + 0x40),
      param7: buf.readInt16LE(off + 0x42),
    });
  }
  return sets;
}

// ---- EnemySetEntry -> enemy list expansion -----------------------------------------
//
// Direct port of SuperMap::add_enemy_and_children (src/Map.cc). Returns a list
// of { type, forcedRare } (forcedRare = the BB "is_default_rare_bb" flag: the
// set entry unconditionally spawns the rare variant). Types NONE and
// NON_ENEMY_NPC are dropped. Ep3-only branches (area 0xFF) are not ported.

const NPC_BASE_TYPES = new Set([
  0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009, 0x000a,
  0x000b, 0x000c, 0x000d, 0x000e, 0x0019, 0x001a, 0x001b, 0x001c, 0x001d, 0x001e,
  0x001f, 0x0020, 0x0021, 0x0022, 0x0024, 0x0025, 0x0026, 0x0027, 0x0028, 0x0029,
  0x002b, 0x002c, 0x002d, 0x0030, 0x0031, 0x0032, 0x0033, 0x0045, 0x0046, 0x00a9,
  0x00d0, 0x00d1, 0x00d2, 0x00d3, 0x00f0, 0x00f1, 0x00f2, 0x00f3, 0x00f4, 0x00f5,
  0x00f6, 0x00f7, 0x00f8, 0x00f9, 0x00fa, 0x00fb, 0x00fc, 0x00fd, 0x00fe, 0x00ff,
  0x0100,
]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function expandEnemySet(e, area, fileLabel) {
  const out = [];
  const add = (type, forcedRare = false) => out.push({ type, forcedRare });

  // Children appended after the switch, mirroring the C++ default path.
  let childType = null;
  let defaultNumChildren = 0;

  if (NPC_BASE_TYPES.has(e.baseType)) return [];

  switch (e.baseType) {
    case 0x0040: // TObjEneMoja
      add("HILDEBEAR", e.param6 >= 1);
      break;
    case 0x0041: {
      // TObjEneLappy
      const type =
        area < 0x24 ? "RAG_RAPPY" : area <= 0x28 ? "SAND_RAPPY_CRATER" : "SAND_RAPPY_DESERT";
      add(type, (e.param6 & 1) !== 0);
      break;
    }
    case 0x0042: // TObjEneBm3FlyNest
      add("MONEST");
      childType = "MOTHMANT";
      defaultNumChildren = 30;
      break;
    case 0x0043: // TObjEneBm5Wolf
      add(e.param2 >= 1 ? "BARBAROUS_WOLF" : "SAVAGE_WOLF");
      break;
    case 0x0044: // TObjEneBeast
      add(["BOOMA", "GOBOOMA", "GIGOBOOMA"][clamp(e.param6, 0, 2)]);
      break;
    case 0x0060: // TObjGrass
      add("GRASS_ASSASSIN");
      break;
    case 0x0061: // TObjEneRe2Flower
      add(area === 0x23 ? "DEL_LILY" : "POISON_LILY");
      break;
    case 0x0062: // TObjEneNanoDrago
      add("NANO_DRAGON");
      break;
    case 0x0063: // TObjEneShark
      add(["EVIL_SHARK", "PAL_SHARK", "GUIL_SHARK"][clamp(e.param6, 0, 2)]);
      break;
    case 0x0064: {
      // TObjEneSlime — head + children created inline. On BB there is no
      // constructor arg to force rare slimes (param7 forces it on DC/PC/GC only).
      defaultNumChildren = -1;
      const numChildren = e.numChildren !== 0 ? e.numChildren : 4;
      for (let z = 0; z < numChildren + 1; z++) add("POFUILLY_SLIME");
      break;
    }
    case 0x0065: // TObjEnePanarms
      defaultNumChildren = -1;
      add("PAN_ARMS");
      add("HIDOOM");
      add("MIGIUM");
      break;
    case 0x0080: // TObjEneDubchik
      add(e.param6 !== 0 ? "GILLCHIC" : "DUBCHIC");
      break;
    case 0x0081: // TObjEneGyaranzo
      add("GARANZ");
      break;
    case 0x0082: // TObjEneMe3ShinowaReal
      add(e.param2 >= 1 ? "SINOW_GOLD" : "SINOW_BEAT");
      defaultNumChildren = 4;
      break;
    case 0x0083: // TObjEneMe1Canadin
      add("CANADINE");
      break;
    case 0x0084: // TObjEneMe1CanadinLeader
      add("CANANE");
      childType = "CANADINE_GROUP";
      defaultNumChildren = 8;
      break;
    case 0x0085: // TOCtrlDubchik
      add("DUBWITCH");
      break;
    case 0x00a0: // TObjEneSaver
      add("DELSABER");
      break;
    case 0x00a1: // TObjEneRe4Sorcerer
      defaultNumChildren = -1;
      add("CHAOS_SORCERER");
      add("BEE_R");
      add("BEE_L");
      break;
    case 0x00a2: // TObjEneDarkGunner
      add("DARK_GUNNER");
      break;
    case 0x00a3: // TObjEneDarkGunCenter
      add("DARK_GUNNER_CONTROL");
      break;
    case 0x00a4: // TObjEneDf2Bringer
      add("CHAOS_BRINGER");
      break;
    case 0x00a5: // TObjEneRe7Berura
      add("DARK_BELRA");
      break;
    case 0x00a6: // TObjEneDimedian
      add(["DIMENIAN", "LA_DIMENIAN", "SO_DIMENIAN"][clamp(e.param6, 0, 2)]);
      break;
    case 0x00a7: // TObjEneBalClawBody
      add("BULCLAW");
      childType = "CLAW";
      defaultNumChildren = 4;
      break;
    case 0x00a8: // subclass of TObjEneBalClawClaw
      add("CLAW");
      break;
    case 0x00c0: // TBoss1Dragon or TBoss5Gryphon
      if (area < 0x12) add("DRAGON");
      else if (area < 0x24) add("GAL_GRYPHON");
      else fail(`${fileLabel}: DRAGON placed outside of Episode 1 or 2`);
      break;
    case 0x00c1: // TBoss2DeRolLe
      defaultNumChildren = -1;
      add("DE_ROL_LE");
      for (let z = 0; z < 0x0a; z++) add("DE_ROL_LE_BODY");
      for (let z = 0; z < 0x09; z++) add("DE_ROL_LE_MINE");
      break;
    case 0x00c2: // TBoss3Volopt
      defaultNumChildren = -1;
      add("VOL_OPT_1");
      for (let z = 0; z < 0x06; z++) add("VOL_OPT_PILLAR");
      for (let z = 0; z < 0x18; z++) add("VOL_OPT_MONITOR");
      add("VOL_OPT_AMP");
      add("VOL_OPT_CORE");
      break;
    case 0x00c5: // subclass of TObjEnemyCustom
      add("VOL_OPT_2");
      break;
    case 0x00c8: // TBoss4DarkFalz — forms 2 and 1 are aliases of the same boss
      defaultNumChildren = -1;
      add("DARK_FALZ_3");
      for (let z = 0; z < 0x1fd; z++) add("DARVANT");
      break;
    case 0x00ca: // TBoss6PlotFalz — the 0x200 children alias the root enemy
      defaultNumChildren = -1;
      add("OLGA_FLOW_2");
      break;
    case 0x00cb: // TBoss7DeRolLeC
      defaultNumChildren = -1;
      add("BARBA_RAY");
      for (let z = 0; z < 0x0a; z++) add("BARBA_RAY_JOINT");
      for (let z = 0; z < 0x24; z++) add("PIG_RAY");
      break;
    case 0x00cc: // TBoss8Dragon
      add("GOL_DRAGON");
      defaultNumChildren = 5;
      break;
    case 0x00d4: // TObjEneMe3StelthReal
      add(e.param6 > 0 ? "SINOW_SPIGELL" : "SINOW_BERILL");
      defaultNumChildren = 4;
      break;
    case 0x00d5: // TObjEneMerillLia
      add(e.param6 > 0 ? "MERILTAS" : "MERILLIA");
      break;
    case 0x00d6: // TObjEneBm9Mericarol
      add(
        e.param6 === 0
          ? "MERICAROL"
          : e.param6 === 1
            ? "MERIKLE"
            : e.param6 === 2
              ? "MERICUS"
              : "MERICARAND",
      );
      break;
    case 0x00d7: // TObjEneBm5GibonU
      add(e.param6 > 0 ? "ZOL_GIBBON" : "UL_GIBBON");
      break;
    case 0x00d8: // TObjEneGibbles
      add("GIBBLES");
      break;
    case 0x00d9: // TObjEneMe1Gee
      add("GEE");
      break;
    case 0x00da: // TObjEneMe1GiGue
      add("GI_GUE");
      break;
    case 0x00db: // TObjEneDelDepth
      add("DELDEPTH");
      break;
    case 0x00dc: // TObjEneDellBiter
      add("DELBITER");
      break;
    case 0x00dd: // TObjEneDolmOlm
      add(e.param6 > 0 ? "DOLMDARL" : "DOLMOLM");
      break;
    case 0x00de: // TObjEneMorfos
      add("MORFOS");
      break;
    case 0x00df: // TObjEneRecobox
      add("RECOBOX");
      childType = "RECON";
      break;
    case 0x00e0: // TObjEneMe3SinowZoaReal or TObjEneEpsilonBody
      if (area === 0x22 || area === 0x23) {
        add("EPSILON");
        defaultNumChildren = 4;
        childType = "EPSIGARD";
      } else {
        add(e.param6 > 0 ? "SINOW_ZELE" : "SINOW_ZOA");
      }
      break;
    case 0x00e1: // TObjEneIllGill
      add("ILL_GILL");
      break;
    case 0x0110:
      add("ASTARK");
      break;
    case 0x0111:
      if (area <= 0x28) add(e.param2 ? "YOWIE_CRATER" : "SATELLITE_LIZARD_CRATER");
      else add(e.param2 ? "YOWIE_DESERT" : "SATELLITE_LIZARD_DESERT");
      break;
    case 0x0112:
      add("MERISSA_A", (e.param6 & 1) !== 0);
      break;
    case 0x0113:
      add("GIRTABLULU");
      break;
    case 0x0114:
      add(area <= 0x28 ? "ZU_CRATER" : "ZU_DESERT", (e.param6 & 1) !== 0);
      break;
    case 0x0115:
      add(["BOOTA", "ZE_BOOTA", "BA_BOOTA"][clamp(e.param6, 0, 2)]);
      break;
    case 0x0116:
      add("DORPHON", (e.param6 & 1) !== 0);
      break;
    case 0x0117:
      add(["GORAN", "PYRO_GORAN", "GORAN_DETONATOR"][clamp(e.param6, 0, 2)]);
      break;
    case 0x0119: {
      // Saint-Milion / Shambertin: 9 body parts + 16 spinners. Kondrieu is the
      // server-rolled rare form (there is no constructor arg for it).
      defaultNumChildren = -1;
      const isShambertin = (e.param6 & 1) !== 0;
      const bodyType = isShambertin ? "SHAMBERTIN" : "SAINT_MILION";
      const spinnerType = isShambertin ? "SHAMBERTIN_SPINNER" : "SAINT_MILION_SPINNER";
      for (let z = 0; z < 9; z++) add(bodyType);
      for (let z = 0; z < 0x10; z++) add(spinnerType);
      break;
    }
    case 0x00c3: // TBoss3VoloptP01
    case 0x00c4: // TBoss3VoloptCore or subclass
    case 0x00c6: // TBoss3VoloptMonitor
    case 0x00c7: // TBoss3VoloptHiraisin
    case 0x0118: // __QUEST_NPC__
      return [];
    default:
      // newserv maps unhandled base types to EnemyType::UNKNOWN with a warning
      // (vanilla files contain some, e.g. base_type 0x0000 filler entries).
      warn(
        `${fileLabel}: unhandled enemy base_type 0x${e.baseType.toString(16).padStart(4, "0")} — entry skipped`,
      );
      return [];
  }

  if (defaultNumChildren >= 0) {
    const numChildren = e.numChildren !== 0 ? e.numChildren : defaultNumChildren;
    const type = childType ?? out[0].type;
    for (let x = 0; x < numChildren; x++) add(type);
  }
  return out;
}

// ---- Variation assembly -----------------------------------------------------------

// Set counts per generated variation, kept out of the dataset but used by the
// reference checks below.
const setCounts = new Map();

function buildVariation(areaInfo, basename) {
  const filename = `${basename}e.dat`;
  const path = join(MAPS_DIR, filename);
  if (!existsSync(path)) {
    warn(`${filename}: free-play variation referenced by set data table but missing on disk`);
    return null;
  }
  const sets = parseEnemySets(path);
  setCounts.set(filename, sets.length);

  // Group spawned enemies by (room, wave); aggregate counts per type. Set
  // entries whose params force the rare variant (e.g. a pinned Al Rappy) are
  // counted directly under the rare type.
  const waveMap = new Map();
  // Note: the floor field inside free-play files is not trustworthy; newserv
  // overrides it with the actual floor at load time (set_enemy_sets_for_floor).
  for (const set of sets) {
    const enemies = expandEnemySet(set, areaInfo.area, filename);
    if (enemies.length === 0) continue;
    const waveKey = set.room * 0x10000 + set.wave;
    let wave = waveMap.get(waveKey);
    if (!wave) {
      wave = { room: set.room, wave: set.wave, counts: new Map() };
      waveMap.set(waveKey, wave);
    }
    for (const { type, forcedRare } of enemies) {
      const finalType = forcedRare ? (rareTypeFor(type, areaInfo.area) ?? type) : type;
      wave.counts.set(finalType, (wave.counts.get(finalType) ?? 0) + 1);
    }
  }

  const waves = [...waveMap.values()]
    .sort((a, b) => a.room - b.room || a.wave - b.wave)
    .map((w) => ({
      room: w.room,
      wave: w.wave,
      enemies: Object.fromEntries(
        [...w.counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    }));

  return { file: filename, waves };
}

// ---- Main -------------------------------------------------------------------------

if (!existsSync(MAPS_DIR)) fail(`maps directory not found: ${MAPS_DIR}`);

const tables = {
  online: parseSetDataTable(join(MAPS_DIR, "SetDataTableOn.rel")),
  offline: parseSetDataTable(join(MAPS_DIR, "SetDataTableOff.rel")),
};
const freePlayCounts = { online: FREE_PLAY_COUNTS_ONLINE, offline: FREE_PLAY_COUNTS_OFFLINE };

const out = { "1": [], "2": [], "4": [] };
for (const areaInfo of AREAS) {
  const floorEntry = {
    floor: areaInfo.floor,
    area: areaInfo.area,
    name: areaInfo.name,
    ...(areaInfo.boss ? { boss: true } : {}),
    online: [],
    offline: [],
  };
  for (const mode of ["online", "offline"]) {
    const layouts = tables[mode][areaInfo.area];
    if (!layouts) fail(`area 0x${areaInfo.area.toString(16)} missing from ${mode} set data table`);
    // Only free-play-reachable variations are emitted. The tables also
    // reference extra layouts beyond these caps, but those are quest-only
    // (many don't even ship as free-play files).
    const [layoutCap, entitiesCap] = freePlayCounts[mode][areaInfo.area];
    for (const [layout, entityList] of layouts.entries()) {
      if (layout >= layoutCap) continue;
      for (const [entities, entry] of entityList.entries()) {
        if (entities >= entitiesCap) continue;
        const variation = buildVariation(areaInfo, entry.enemyBasename);
        if (variation) floorEntry[mode].push(variation);
      }
    }
  }
  if (floorEntry.online.length === 0 && floorEntry.offline.length === 0) {
    // Seaside Area (night) and Control Tower are quest-only in BB: the set
    // data tables reference map files that don't ship for free play.
    warn(`${areaInfo.name}: no free-play map files exist — floor omitted`);
    continue;
  }
  out[areaInfo.episode].push(floorEntry);
}

// ---- Reference checks (facts verified against the vanilla BB files) ----------------

const forest1 = out["1"].find((f) => f.floor === 1);
const forest1Online0 = forest1?.online[0];
if (forest1Online0?.file !== "map_forest01_00e.dat") {
  fail(`Forest 1 online var 0 file is ${forest1Online0?.file}, expected map_forest01_00e.dat`);
}
if (setCounts.get("map_forest01_00e.dat") !== 67) {
  fail(`map_forest01_00e.dat has ${setCounts.get("map_forest01_00e.dat")} enemy sets, expected 67`);
}
if (setCounts.get("map_forest01_00_offe.dat") !== 32) {
  fail(
    `map_forest01_00_offe.dat has ${setCounts.get("map_forest01_00_offe.dat")} enemy sets, expected 32`,
  );
}
if (forest1.online.length !== 5 || forest1.offline.length !== 3) {
  fail(
    `Forest 1 has ${forest1.online.length} online / ${forest1.offline.length} offline variations, expected 5 / 3`,
  );
}
const forest1Types = new Set(
  forest1Online0.waves.flatMap((w) => Object.keys(w.enemies)),
);
for (const expected of ["BOOMA", "RAG_RAPPY", "MONEST", "MOTHMANT", "SAVAGE_WOLF"]) {
  if (!forest1Types.has(expected)) {
    fail(`Forest 1 online var 0 is missing expected enemy ${expected}`);
  }
}
const dragon = out["1"].find((f) => f.floor === 11)?.online[0];
if (!dragon?.waves.some((w) => w.enemies.DRAGON)) {
  fail("Dragon boss floor does not contain DRAGON");
}

// Every spawned type should be resolvable against enemy-stats.json, except for
// control/structural entities and boss body parts that have no stat rows in
// the condensed dataset (their stats live with the canonical boss entry).
const STATLESS_TYPES = new Set([
  "DUBWITCH",
  "DARK_GUNNER_CONTROL",
  "BEE_L",
  "BEE_R",
  "DARVANT",
  "DE_ROL_LE_BODY",
  "DE_ROL_LE_MINE",
  "PIG_RAY",
  "VOL_OPT_1",
  "VOL_OPT_AMP",
  "VOL_OPT_CORE",
  "VOL_OPT_MONITOR",
  "VOL_OPT_PILLAR",
]);
const enemyStats = JSON.parse(readFileSync(join(DATA_DIR, "enemy-stats.json"), "utf8"));
const unknownTypes = new Set();
for (const floors of Object.values(out)) {
  for (const floorEntry of floors) {
    for (const mode of ["online", "offline"]) {
      for (const variation of floorEntry[mode]) {
        for (const wave of variation.waves) {
          for (const type of Object.keys(wave.enemies)) {
            if (!enemyStats[type] && !STATLESS_TYPES.has(type)) {
              unknownTypes.add(type);
            }
            // The runtime rare roll (map-spawns.ts) upgrades to rareTypeFor's
            // result, so those types must resolve too.
            const rareType = rareTypeFor(type, floorEntry.area);
            if (rareType && !enemyStats[rareType]) {
              unknownTypes.add(rareType);
            }
          }
        }
      }
    }
  }
}
if (unknownTypes.size > 0) {
  fail(`spawned enemy types missing from enemy-stats.json: ${[...unknownTypes].sort().join(", ")}`);
}

// ---- Write ------------------------------------------------------------------------

for (const w of warnings) console.warn(`warning: ${w}`);
mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
const totalVariations = Object.values(out)
  .flat()
  .reduce((n, f) => n + f.online.length + f.offline.length, 0);
console.log(
  `Wrote ${Object.values(out).flat().length} floors (${totalVariations} variations) to ${OUT_PATH}`,
);
