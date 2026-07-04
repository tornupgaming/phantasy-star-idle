#!/usr/bin/env node
/**
 * Extracts the authentic PSO Blue Burst common drop tables from a local
 * newserv clone into src/engine/data/common-drop-table.json.
 *
 * Source (read-only, extraction time only):
 *   <newserv>/system/tables/common-table-v3-v4.json
 *
 * The source is newserv's phosg JSON dialect (// comments, hex literals) and
 * stores each scenario as a delta from the previous table. This script resolves
 * the inheritance chain at extraction time and emits standard JSON for the
 * game slice we support: Episode 1, Normal game mode, Normal/Hard/Ultimate,
 * all 10 section IDs. Technique tables are intentionally omitted; tech-disk
 * tool-class weights are zeroed in the emitted ToolClassProbTable.
 *
 * Usage: node scripts/extract-common-table.mjs [newserv-root]
 *        (or NEWSERV_ROOT env var; defaults to /home/psmith/projects/newserv)
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NEWSERV_ROOT =
  process.argv[2] ?? process.env.NEWSERV_ROOT ?? "/home/psmith/projects/newserv";
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "engine", "data");
const OUT_PATH = join(DATA_DIR, "common-drop-table.json");
const RARE_OUT_PATH = join(DATA_DIR, "rare-drop-table.json");
const ITEM_TABLE_PATH = join(DATA_DIR, "item-table.json");

const EPISODE = "Ep1";
const MODE = "Normal";
const DIFFICULTIES = ["Normal", "Hard", "VeryHard", "Ultimate"];
// newserv's JSON token keeps the historical misspelling "Greennill"; the
// engine-facing dataset uses the engine's SectionId spelling ("Greenill").
const SECTION_IDS = [
  ["Viridia", "Viridia"],
  ["Greenill", "Greennill"],
  ["Skyly", "Skyly"],
  ["Bluefull", "Bluefull"],
  ["Purplenum", "Purplenum"],
  ["Pinkal", "Pinkal"],
  ["Redria", "Redria"],
  ["Oran", "Oran"],
  ["Yellowboze", "Yellowboze"],
  ["Whitill", "Whitill"],
];
const SOURCE_SECTION_INDEX = new Map(SECTION_IDS.map(([, source], index) => [source, index]));
const SOURCE_DIFFICULTIES = ["Normal", "Hard", "VeryHard", "Ultimate"];
const SOURCE_DIFFICULTY_INDEX = new Map(SOURCE_DIFFICULTIES.map((d, index) => [d, index]));

const CARRIED_KEYS = [
  "ArmorOrShieldTypeBias",
  "ArmorShieldTypeIndexProbTable",
  "ArmorSlotCountProbTable",
  "BaseWeaponTypeProbTable",
  "BonusTypeProbTable",
  "BonusValueProbTable",
  "BoxItemClassProbTable",
  "BoxMesetaRanges",
  "EnemyItemClasses",
  "EnemyMesetaRanges",
  "EnemyTypeDropProbs",
  "GrindProbTable",
  "HasRareBonusValueProbTable",
  "NonRareBonusProbSpec",
  "SpecialMult",
  "SpecialPercent",
  "SubtypeAreaLengthTable",
  "SubtypeBaseTable",
  "ToolClassProbTable",
  "UnitMaxStarsTable",
];
const OMITTED_TECHNIQUE_KEYS = ["TechniqueIndexProbTable", "TechniqueLevelRanges"];

const ARRAY_SHAPES = {
  ArmorShieldTypeIndexProbTable: [5],
  ArmorSlotCountProbTable: [5],
  BaseWeaponTypeProbTable: [12],
  BonusTypeProbTable: [6, 10],
  BonusValueProbTable: [23, 6],
  BoxItemClassProbTable: [7, 10],
  BoxMesetaRanges: [10, 2],
  GrindProbTable: [9, 4],
  NonRareBonusProbSpec: [3, 10],
  SpecialMult: [10],
  SpecialPercent: [10],
  SubtypeAreaLengthTable: [12],
  SubtypeBaseTable: [12],
  ToolClassProbTable: [28, 10],
  UnitMaxStarsTable: [10],
};
const NUMBER_FIELDS = new Set(["ArmorOrShieldTypeBias"]);
const BOOLEAN_FIELDS = new Set(["HasRareBonusValueProbTable"]);
const ENEMY_DICT_FIELDS = new Set(["EnemyItemClasses", "EnemyMesetaRanges", "EnemyTypeDropProbs"]);
const TECH_DISK_TOOL_CLASS_ID = 25; // PMT Tool.ID 25 is the technique-disk class (03 02 xx).
const NONE_RT_INDEX = 0xff;

function fail(msg) {
  console.error(`extract-common-table: ${msg}`);
  console.error("No output written.");
  process.exit(1);
}

function parseDialectJson(text, label) {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === "\\") {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i += 1;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    const hexStart = c === "0" && (text[i + 1] === "x" || text[i + 1] === "X");
    const negHexStart = c === "-" && text[i + 1] === "0" && (text[i + 2] === "x" || text[i + 2] === "X");
    if (hexStart || negHexStart) {
      const sign = negHexStart ? -1 : 1;
      if (negHexStart) i += 1;
      let j = i + 2;
      while (j < text.length && /[0-9A-Fa-f]/.test(text[j])) j += 1;
      if (j === i + 2) fail(`${label}: bare hex literal at offset ${i}`);
      out += String(sign * parseInt(text.slice(i + 2, j), 16));
      i = j;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j += 1;
      if (text[j] === "}" || text[j] === "]") {
        i += 1;
        continue;
      }
    }
    out += c;
    i += 1;
  }
  try {
    return JSON.parse(out);
  } catch (err) {
    fail(`${label}: dialect rewrite did not yield valid JSON (${err.message}) — upstream format may have changed`);
  }
}

function keyFor(mode, difficulty, sourceSectionId) {
  return `${EPISODE}:${mode}:${difficulty}:${sourceSectionId}`;
}

function previousScenario(mode, difficulty, sourceSectionId) {
  const sectionIndex = SOURCE_SECTION_INDEX.get(sourceSectionId);
  if (sectionIndex === undefined) fail(`unknown section ID token ${sourceSectionId}`);
  if (sectionIndex !== 0) {
    return { mode, difficulty, sourceSectionId: SECTION_IDS[sectionIndex - 1][1] };
  }
  const difficultyIndex = SOURCE_DIFFICULTY_INDEX.get(difficulty);
  if (difficultyIndex === undefined) fail(`unknown difficulty token ${difficulty}`);
  if (difficultyIndex !== 0) {
    return { mode, difficulty: SOURCE_DIFFICULTIES[difficultyIndex - 1], sourceSectionId };
  }
  if (mode !== "Normal") {
    return { mode: "Normal", difficulty: "Normal", sourceSectionId };
  }
  return null;
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

const resolving = new Set();
const resolved = new Map();
function resolveScenario(raw, mode, difficulty, sourceSectionId) {
  const key = keyFor(mode, difficulty, sourceSectionId);
  if (resolved.has(key)) return clone(resolved.get(key));
  if (resolving.has(key)) fail(`cyclic inheritance while resolving ${key}`);
  const own = raw[key];
  if (!own) fail(`missing source scenario ${key}`);

  resolving.add(key);
  const prev = previousScenario(mode, difficulty, sourceSectionId);
  const table = prev ? resolveScenario(raw, prev.mode, prev.difficulty, prev.sourceSectionId) : {};
  for (const [field, value] of Object.entries(own)) {
    if (OMITTED_TECHNIQUE_KEYS.includes(field)) continue;
    if (!CARRIED_KEYS.includes(field)) fail(`${key}: unexpected field ${field} — update extractor for upstream shape drift`);
    table[field] = clone(value);
  }
  resolving.delete(key);

  normalizeRangeMaps(table);
  validateResolvedTable(key, table);
  zeroTechDiskWeights(table);
  resolved.set(key, table);
  return clone(table);
}

function assertArrayShape(label, value, shape) {
  if (!Array.isArray(value)) fail(`${label}: expected array`);
  if (value.length !== shape[0]) fail(`${label}: length ${value.length}, expected ${shape[0]}`);
  if (shape.length === 1) {
    for (const [i, v] of value.entries()) {
      if (typeof v !== "number") fail(`${label}[${i}]: expected number`);
    }
    return;
  }
  for (const [i, row] of value.entries()) assertArrayShape(`${label}[${i}]`, row, shape.slice(1));
}

function normalizeRangeMaps(table) {
  for (const [enemy, value] of Object.entries(table.EnemyMesetaRanges)) {
    if (typeof value === "number") table.EnemyMesetaRanges[enemy] = [value, value];
  }
}

function validateEnemyDict(label, value, rangeShape) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label}: expected object`);
  const entries = Object.entries(value);
  if (entries.length === 0) fail(`${label}: expected at least one enemy entry`);
  for (const [enemy, v] of entries) {
    if (!/^[A-Z0-9_]+$/.test(enemy)) fail(`${label}: suspicious enemy key ${enemy}`);
    if (rangeShape) assertArrayShape(`${label}.${enemy}`, v, rangeShape);
    else if (typeof v !== "number") fail(`${label}.${enemy}: expected number`);
  }
}

function validateResolvedTable(key, table) {
  for (const carriedKey of CARRIED_KEYS) {
    if (!(carriedKey in table)) fail(`${key}: failed to resolve required field ${carriedKey}`);
  }
  for (const [field, shape] of Object.entries(ARRAY_SHAPES)) assertArrayShape(`${key}.${field}`, table[field], shape);
  for (const field of NUMBER_FIELDS) {
    if (typeof table[field] !== "number") fail(`${key}.${field}: expected number`);
  }
  for (const field of BOOLEAN_FIELDS) {
    if (typeof table[field] !== "boolean") fail(`${key}.${field}: expected boolean`);
  }
  for (const field of ENEMY_DICT_FIELDS) {
    validateEnemyDict(`${key}.${field}`, table[field], field === "EnemyMesetaRanges" ? [2] : null);
  }
}

function zeroTechDiskWeights(table) {
  const row = table.ToolClassProbTable[TECH_DISK_TOOL_CLASS_ID];
  if (!row) fail(`ToolClassProbTable missing tech-disk class row ${TECH_DISK_TOOL_CLASS_ID}`);
  for (let i = 0; i < row.length; i++) row[i] = 0;
}

function parseIntToken(token) {
  const t = token.trim();
  if (t === "NONE") return NONE_RT_INDEX;
  if (/^0x[0-9A-Fa-f]+$/.test(t)) return parseInt(t.slice(2), 16);
  if (/^\d+$/.test(t)) return Number(t);
  fail(`cannot parse integer token ${JSON.stringify(token)}`);
}

function parseEnemyTypeDefinitions() {
  const cc = readFileSync(join(NEWSERV_ROOT, "src", "EnemyType.cc"), "utf8");
  const rowRe = new RegExp(
    String.raw`\{EnemyType::(\w+),\s*([^,{}]+),\s*([^,{}]+),\s*([^,{}]+),\s*` +
      String.raw`\{([^{}]*)\},\s*\{([^{}]*)\},\s*\{([^{}]*)\},\s*\{([^{}]*)\},\s*` +
      String.raw`"(\w+)",\s*(?:"([^"]*)"|nullptr),\s*(?:"([^"]*)"|nullptr)`,
    "g",
  );
  const defs = new Map();
  let rows = 0;
  for (const match of cc.matchAll(rowRe)) {
    rows += 1;
    const [, type, flags, rtIndexToken, oldRtIndexToken, statsIndexes, attackIndexes, resistIndexes, movementIndexes, internalName, displayName, ultimateName] = match;
    if (type !== internalName) fail(`EnemyType.cc row ${type} has mismatched internal name ${internalName}`);
    defs.set(type, {
      enemyType: type,
      rtIndex: parseIntToken(rtIndexToken),
      oldRtIndex: parseIntToken(oldRtIndexToken),
      ep1: flags.includes("EP1"),
      rare: flags.includes("RARE"),
      boss: flags.includes("BOSS"),
      statsIndexes: statsIndexes.split(",").map((s) => s.trim()).filter(Boolean).map(parseIntToken),
      attackIndexes: attackIndexes.split(",").map((s) => s.trim()).filter(Boolean).map(parseIntToken),
      resistIndexes: resistIndexes.split(",").map((s) => s.trim()).filter(Boolean).map(parseIntToken),
      movementIndexes: movementIndexes.split(",").map((s) => s.trim()).filter(Boolean).map(parseIntToken),
      displayName: displayName ?? null,
      ultimateName: ultimateName ?? null,
    });
  }
  if (rows < 100) fail(`parsed only ${rows} EnemyType.cc rows — upstream format may have changed`);
  return defs;
}

function parseWiredEnemyStatsTypes() {
  const content = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "engine", "content.ts"), "utf8");
  const statsTypes = new Set();
  const re = /enemy\(\s*"[^"]+"\s*,\s*"([A-Z0-9_]+)"/g;
  for (const match of content.matchAll(re)) statsTypes.add(match[1]);
  if (statsTypes.size === 0) fail("found no wired enemies in src/engine/content.ts");
  return [...statsTypes].sort();
}

function buildEnemyRtIndexMap(defs, wiredStatsTypes, outTables) {
  const result = {};
  for (const statsType of wiredStatsTypes) {
    const def = defs.get(statsType);
    if (!def) fail(`wired enemy statsType ${statsType} does not exist in newserv EnemyType.cc`);
    if (!def.ep1) fail(`wired enemy statsType ${statsType} is not valid in Episode 1`);
    if (def.rtIndex === NONE_RT_INDEX) fail(`wired enemy statsType ${statsType} has no rt_index in newserv EnemyType.cc`);
    result[statsType] = {
      enemyType: def.enemyType,
      rtIndex: def.rtIndex,
      rare: def.rare,
      boss: def.boss,
      displayName: def.displayName,
      ultimateName: def.ultimateName,
    };
  }
  return result;
}

function wiredBoxWhereKeys() {
  const content = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "engine", "content.ts"), "utf8");
  const floorToRareBoxArea = new Map([
    [1, "Forest1"],
    [2, "Forest2"],
    [3, "Cave1"],
    [4, "Cave2"],
    [5, "Cave3"],
    [6, "Mine1"],
    [7, "Mine2"],
    [8, "Ruins1"],
    [9, "Ruins2"],
    [10, "Ruins3"],
    // Boss-floor rule: Dragon (floor 11) uses Caves 1 / area_norm 2.
    [11, "Cave1"],
  ]);
  const boxes = new Set();
  // Area blocks wire floors via `floor:` and optional `bossFloor:`; every wired
  // floor's boxes draw from its rare-table Box area (boxDropTableId is gone).
  const areasBlock = content.slice(content.indexOf("export const AREAS"));
  const floorRe = /(?:floor|bossFloor):\s*(\d+)/g;
  for (const match of areasBlock.matchAll(floorRe)) {
    const floor = Number(match[1]);
    const rareBoxArea = floorToRareBoxArea.get(floor);
    if (!rareBoxArea) fail(`wired area floor ${floor} has no rare-table Box area mapping`);
    boxes.add(`Box-${rareBoxArea}`);
  }
  if (boxes.size === 0) fail("found no wired box areas in src/engine/content.ts");
  return boxes;
}

function gearKindForCode(itemDataset, code) {
  if (itemDataset.weapons?.[code]) return "weapon";
  if (itemDataset.frames?.[code]) return "frame";
  if (itemDataset.barriers?.[code]) return "barrier";
  if (itemDataset.units?.[code]) return "unit";
  return null;
}

function itemCodeFromRareDesc(desc) {
  if (typeof desc !== "number" || !Number.isInteger(desc) || desc < 0 || desc > 0xffffff) {
    fail(`unsupported rare item descriptor ${JSON.stringify(desc)} — expected 3-byte numeric item code`);
  }
  return desc.toString(16).toUpperCase().padStart(6, "0");
}

function normalizeProbability(prob) {
  if (typeof prob === "number" && Number.isInteger(prob) && prob >= 0) {
    return prob / 0x100000000;
  }
  if (typeof prob === "string") {
    const match = /^(\d+)\/(\d+)$/.exec(prob);
    if (!match) fail(`unsupported rare probability ${JSON.stringify(prob)}`);
    const numerator = Number(match[1]);
    const denominator = Number(match[2]);
    if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
      fail(`invalid rare probability fraction ${prob}`);
    }
    return numerator / denominator;
  }
  fail(`unsupported rare probability ${JSON.stringify(prob)}`);
}

function extractRareTable(itemDataset, wiredStatsTypes, boxWhereKeys) {
  const rareRaw = parseDialectJson(
    readFileSync(join(NEWSERV_ROOT, "system", "tables", "rare-table-v4.json"), "utf8"),
    "rare-table-v4.json",
  );
  const root = rareRaw?.Normal?.Episode1;
  if (!root || typeof root !== "object" || Array.isArray(root)) fail("rare-table-v4.json missing Normal/Episode1 root");

  const allowedWhere = new Set([...wiredStatsTypes, ...boxWhereKeys]);
  const outTables = {};
  for (const difficulty of DIFFICULTIES) {
    const sourceDifficulty = root[difficulty];
    if (!sourceDifficulty || typeof sourceDifficulty !== "object" || Array.isArray(sourceDifficulty)) {
      fail(`rare-table-v4.json missing Normal/Episode1/${difficulty}`);
    }
    outTables[difficulty] = {};
    for (const [engineSectionId, sourceSectionId] of SECTION_IDS) {
      const scenario = sourceDifficulty[sourceSectionId];
      if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
        fail(`rare-table-v4.json missing ${difficulty}/${sourceSectionId}`);
      }
      const scenarioOut = {};
      for (const where of Object.keys(scenario).sort()) {
        if (!allowedWhere.has(where)) continue;
        const specs = scenario[where];
        if (!Array.isArray(specs)) fail(`${difficulty}/${sourceSectionId}/${where}: specs is not an array`);
        const kept = [];
        for (const spec of specs) {
          if (!Array.isArray(spec) || spec.length !== 2) fail(`${difficulty}/${sourceSectionId}/${where}: malformed spec ${JSON.stringify(spec)}`);
          const code = itemCodeFromRareDesc(spec[1]);
          const kind = gearKindForCode(itemDataset, code);
          if (!kind) continue;
          kept.push({ probability: normalizeProbability(spec[0]), probabilityRaw: spec[0], code, kind });
        }
        if (kept.length > 0) scenarioOut[where] = kept;
      }
      outTables[difficulty][engineSectionId] = scenarioOut;
    }
  }
  return {
    source: "newserv/system/tables/rare-table-v4.json",
    itemTableSource: "src/engine/data/item-table.json",
    episode: EPISODE,
    mode: MODE,
    difficulties: DIFFICULTIES,
    sectionIds: SECTION_IDS.map(([engine]) => engine),
    retainedWhereKeys: [...allowedWhere].sort(),
    tables: outTables,
  };
}

const raw = parseDialectJson(
  readFileSync(join(NEWSERV_ROOT, "system", "tables", "common-table-v3-v4.json"), "utf8"),
  "common-table-v3-v4.json",
);
if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("source root is not an object");

const enemyTypeDefs = parseEnemyTypeDefinitions();
const wiredStatsTypes = parseWiredEnemyStatsTypes();
const itemDataset = JSON.parse(readFileSync(ITEM_TABLE_PATH, "utf8"));

const outTables = {};
for (const difficulty of DIFFICULTIES) {
  outTables[difficulty] = {};
  for (const [engineSectionId, sourceSectionId] of SECTION_IDS) {
    outTables[difficulty][engineSectionId] = resolveScenario(raw, MODE, difficulty, sourceSectionId);
  }
}

const enemyRtIndex = buildEnemyRtIndexMap(enemyTypeDefs, wiredStatsTypes, outTables);

const out = {
  source: "newserv/system/tables/common-table-v3-v4.json",
  enemyTypeSource: "newserv/src/EnemyType.cc",
  episode: EPISODE,
  mode: MODE,
  difficulties: DIFFICULTIES,
  sectionIds: SECTION_IDS.map(([engine]) => engine),
  techDiskToolClassId: TECH_DISK_TOOL_CLASS_ID,
  omittedTechniqueTables: OMITTED_TECHNIQUE_KEYS,
  enemyRtIndex,
  tables: outTables,
};

const rareOut = extractRareTable(itemDataset, wiredStatsTypes, wiredBoxWhereKeys());

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);
writeFileSync(RARE_OUT_PATH, `${JSON.stringify(rareOut, null, 2)}\n`);
console.log(`Wrote ${OUT_PATH}`);
console.log(`Wrote ${RARE_OUT_PATH}`);
