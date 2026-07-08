/**
 * Extracts authentic PSO room geometry for Episode 1 free-play floors from a
 * local newserv clone into src/engine/data/room-geometry.json.
 *
 * Sources (read-only, extraction time only):
 *   <newserv>/system/maps/room-layout-index.json — per (area, layout variant)
 *       world-space room transforms, keyed "<area_hex>-<layout_hex>" ->
 *       { room_id_hex: [x, y, z, angleX, angleY, angleZ] } (RoomLayoutIndex in
 *       src/Map.cc; pre-extracted from the client n.rel files).
 *   <newserv>/system/maps/bb-v4/SetDataTableOff.rel — the offline set data
 *       table (area -> layout variation -> entity variation -> map file
 *       basename), parsed exactly as extract-map-spawns.mjs does. This is the
 *       authoritative variation-file -> layout-variant join; the filename
 *       token convention (map_<area>_<layout>_<entities>_offe.dat, layout
 *       omitted on single-layout floors) is cross-checked against it and any
 *       disagreement fails the extraction.
 *   src/engine/data/map-spawns.json — our generated spawn dataset; every Ep1
 *       offline variation must join to a layout and every wave's room id must
 *       exist in that layout's geometry, or the extraction fails.
 *
 * Only Ep1 non-boss floors (Forest 1 .. Ruins 3, areas 0x01-0x0a) are emitted:
 * boss arenas are single-room and get no minimap (battle-minimap spec).
 *
 * Usage: node scripts/extract-room-geometry.mjs [newserv-root]
 *        (or NEWSERV_ROOT env var; defaults to /home/psmith/projects/newserv)
 *
 * The output is deterministic: fixed iteration order, fixed field order,
 * 2-space indent. Regenerating against the same clone must be byte-identical.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NEWSERV_ROOT =
  process.argv[2] ?? process.env.NEWSERV_ROOT ?? "/home/psmith/projects/newserv";
const MAPS_DIR = join(NEWSERV_ROOT, "system", "maps");
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "engine", "data");
const SPAWNS_PATH = join(DATA_DIR, "map-spawns.json");
const OUT_PATH = join(DATA_DIR, "room-geometry.json");

function fail(msg) {
  console.error(`extract-room-geometry: ${msg}`);
  console.error("No output written.");
  process.exit(1);
}

// Ep1 non-boss floors: area numbers and floor numbers per newserv's
// SetDataTableBase::default_floor_to_area (src/Map.cc — Ep1 floors are the
// contiguous area ids 0x00-0x11; 0x01-0x0a are the combat floors).
const FLOORS = [
  { area: 0x01, floor: 1, name: "Forest 1" },
  { area: 0x02, floor: 2, name: "Forest 2" },
  { area: 0x03, floor: 3, name: "Cave 1" },
  { area: 0x04, floor: 4, name: "Cave 2" },
  { area: 0x05, floor: 5, name: "Cave 3" },
  { area: 0x06, floor: 6, name: "Mine 1" },
  { area: 0x07, floor: 7, name: "Mine 2" },
  { area: 0x08, floor: 8, name: "Ruins 1" },
  { area: 0x09, floor: 9, name: "Ruins 2" },
  { area: 0x0a, floor: 10, name: "Ruins 3" },
];

// ---- SetDataTableOff.rel parsing (same format as extract-map-spawns.mjs) ----------

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
        entities.push({ enemyBasename: cstr(u32(base + 4)) });
      }
      layouts.push(entities);
    }
    areas.push(layouts);
  }
  return areas;
}

/**
 * Filename-token cross-check: two numeric tokens after the area word mean
 * <layout>_<entities>; a single token is the entity variant on a
 * single-layout floor (layout 0). The `_off` marker is zone-dependent
 * (forest/cave offline files carry it, mine/ruins don't). Returns the layout
 * number or null when the name doesn't follow the free-play convention at all.
 */
function layoutFromFilename(file) {
  const m = /^map_[a-z]+\d*((?:_\d+)+?)(?:_off)?e\.dat$/.exec(file);
  if (!m) return null;
  const tokens = m[1].slice(1).split("_");
  if (tokens.length === 1) return 0;
  if (tokens.length === 2) return parseInt(tokens[0], 10);
  return null;
}

// ---- Load sources -----------------------------------------------------------------

const layoutIndexPath = join(MAPS_DIR, "room-layout-index.json");
if (!existsSync(layoutIndexPath)) fail(`room layout index not found: ${layoutIndexPath}`);
const layoutIndex = JSON.parse(readFileSync(layoutIndexPath, "utf8"));

const setTablePath = join(MAPS_DIR, "bb-v4", "SetDataTableOff.rel");
if (!existsSync(setTablePath)) fail(`offline set data table not found: ${setTablePath}`);
const setTable = parseSetDataTable(setTablePath);

if (!existsSync(SPAWNS_PATH)) fail(`spawn dataset not found: ${SPAWNS_PATH} (run extract:map-spawns first)`);
const spawns = JSON.parse(readFileSync(SPAWNS_PATH, "utf8"));

// ---- Build ------------------------------------------------------------------------

const errors = [];
const out = { 1: [] };

for (const { area, floor, name } of FLOORS) {
  const spawnFloor = spawns["1"].find((f) => f.floor === floor);
  if (!spawnFloor) {
    errors.push(`${name}: missing from map-spawns.json`);
    continue;
  }

  // Authoritative file -> layout join from the offline set data table.
  const fileToLayoutNum = new Map();
  for (const [layoutNum, entityList] of setTable[area].entries()) {
    for (const entry of entityList) {
      if (entry.enemyBasename) fileToLayoutNum.set(`${entry.enemyBasename}e.dat`, layoutNum);
    }
  }

  const fileToLayout = {};
  const layoutKeys = new Set();
  for (const variation of spawnFloor.offline) {
    const layoutNum = fileToLayoutNum.get(variation.file);
    if (layoutNum === undefined) {
      errors.push(`${name}: ${variation.file} not present in SetDataTableOff.rel`);
      continue;
    }
    const fromName = layoutFromFilename(variation.file);
    if (fromName !== layoutNum) {
      errors.push(
        `${name}: ${variation.file} — filename token says layout ${fromName}, set data table says ${layoutNum}`,
      );
      continue;
    }
    const layoutKey =
      `${area.toString(16).padStart(2, "0")}-${layoutNum.toString(16).padStart(2, "0")}`.toUpperCase();
    fileToLayout[variation.file] = layoutKey;
    layoutKeys.add(layoutKey);
  }

  const layouts = {};
  for (const layoutKey of [...layoutKeys].sort()) {
    const indexRooms = layoutIndex[layoutKey];
    if (!indexRooms) {
      errors.push(`${name}: layout ${layoutKey} missing from room-layout-index.json`);
      continue;
    }
    layouts[layoutKey] = Object.entries(indexRooms)
      .map(([roomHex, transform]) => ({
        room: parseInt(roomHex, 16),
        x: transform[0],
        z: transform[2],
      }))
      .sort((a, b) => a.room - b.room);
  }

  // Every wave's room id must exist in its variation's layout geometry.
  for (const variation of spawnFloor.offline) {
    const layoutKey = fileToLayout[variation.file];
    if (!layoutKey || !layouts[layoutKey]) continue; // already reported above
    const roomIds = new Set(layouts[layoutKey].map((r) => r.room));
    for (const wave of variation.waves) {
      if (!roomIds.has(wave.room)) {
        errors.push(`${name}: ${variation.file} wave room ${wave.room} not in layout ${layoutKey}`);
      }
    }
  }

  out[1].push({ floor, area, name, fileToLayout, layouts });
}

if (errors.length > 0) {
  for (const e of errors) console.error(`extract-room-geometry: ${e}`);
  fail(`${errors.length} join/validation error(s)`);
}

// ---- Reference checks (facts verified against the vanilla BB data) -----------------

const forest1 = out[1].find((f) => f.floor === 1);
const forest1Layouts = Object.keys(forest1.layouts);
if (forest1Layouts.length !== 1 || forest1Layouts[0] !== "01-00") {
  fail(`Forest 1 layouts are [${forest1Layouts}], expected exactly 01-00`);
}
const cave1 = out[1].find((f) => f.floor === 3);
if (Object.keys(cave1.layouts).length !== 3) {
  fail(`Cave 1 has ${Object.keys(cave1.layouts).length} layouts, expected 3`);
}

writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
const floorCount = out[1].length;
const layoutCount = out[1].reduce((n, f) => n + Object.keys(f.layouts).length, 0);
console.log(`extract-room-geometry: wrote ${floorCount} floors, ${layoutCount} layouts to ${OUT_PATH}`);
