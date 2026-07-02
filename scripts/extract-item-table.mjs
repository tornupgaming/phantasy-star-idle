/**
 * Extracts the authentic PSO Blue Burst item parameter table from a local
 * newserv clone into src/engine/data/item-table.json (item-parameter-data spec).
 *
 * Sources (read-only, extraction time only):
 *   <newserv>/system/tables/item-parameter-table-bb-v4.json — stats/requirements/etc.
 *   <newserv>/system/tables/names-v4.json                   — item code → display name
 *
 * Both files are in newserv's phosg JSON dialect (// comments, hex literals)
 * and are parsed here; the emitted dataset is standard JSON. Item codes are
 * 6 hex digits (TTGGII: type byte, group byte, index byte), except mags, which
 * the source abbreviates to 4 digits (TTGG) — normalized here to 6 (append 00,
 * the form names-v4.json uses). Star values are resolved at extraction time
 * via StarValues[entry.ID − StarValueBaseIndex].
 *
 * Usage: node scripts/extract-item-table.mjs [newserv-root]
 *        (or NEWSERV_ROOT env var; defaults to /home/psmith/projects/newserv)
 *
 * The output is deterministic: sorted keys, fixed field order, 2-space indent.
 * Regenerating against the same clone must be byte-identical.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NEWSERV_ROOT =
  process.argv[2] ?? process.env.NEWSERV_ROOT ?? "/home/psmith/projects/newserv";
const OUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "engine",
  "data",
  "item-table.json",
);

const EXPECTED_TOTAL_ENTRIES = 1536;
const EXPECTED_COUNTS = { weapons: 903, frames: 89, barriers: 166, units: 101, mags: 83, tools: 194 };
// WeaponKind is the authentic animation/behavior category (0..18); pacing's
// speed lookup and the future frame-data port key off it.
const WEAPON_KIND_COUNT = 19;

function fail(msg) {
  console.error(`extract-item-table: ${msg}`);
  console.error("No output written.");
  process.exit(1);
}

// ---- newserv JSON dialect ------------------------------------------------------
//
// String-aware single pass: strips //-to-EOL comments and rewrites hex literals
// (0xFF, -0x1) to decimal, leaving string contents untouched, then JSON.parses.

function parseDialectJson(text, label) {
  let out = "";
  let i = 0;
  const n = text.length;
  let inString = false;
  while (i < n) {
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
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "0" && (text[i + 1] === "x" || text[i + 1] === "X")) {
      let j = i + 2;
      while (j < n && /[0-9A-Fa-f]/.test(text[j])) j += 1;
      if (j === i + 2) fail(`${label}: bare "0x" with no hex digits at offset ${i}`);
      out += String(parseInt(text.slice(i + 2, j), 16));
      i = j;
      continue;
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

const table = parseDialectJson(
  readFileSync(join(NEWSERV_ROOT, "system", "tables", "item-parameter-table-bb-v4.json"), "utf8"),
  "item-parameter-table-bb-v4.json",
);
const names = parseDialectJson(
  readFileSync(join(NEWSERV_ROOT, "system", "tables", "names-v4.json"), "utf8"),
  "names-v4.json",
);

// ---- Shape assertions ----------------------------------------------------------

for (const key of [
  "Items",
  "StarValues",
  "StarValueBaseIndex",
  "ArmorSaleDivisor",
  "ShieldSaleDivisor",
  "UnitSaleDivisor",
]) {
  if (!(key in table)) fail(`missing top-level section "${key}" in item table`);
}
if (!Array.isArray(table.StarValues) || table.StarValues.length === 0) {
  fail("StarValues is not a non-empty array");
}

const itemCodes = Object.keys(table.Items);
if (itemCodes.length !== EXPECTED_TOTAL_ENTRIES) {
  fail(`Items has ${itemCodes.length} entries, expected ${EXPECTED_TOTAL_ENTRIES} — upstream data may have changed`);
}

function requireFields(code, entry, fields) {
  for (const f of fields) {
    if (typeof entry[f] !== "number") {
      fail(`entry ${code}: missing or non-numeric field "${f}"`);
    }
  }
}

// newserv semantics: stars default to 0 for ids outside the star-value window.
function starsForId(id) {
  const idx = id - table.StarValueBaseIndex;
  return idx >= 0 && idx < table.StarValues.length ? table.StarValues[idx] : 0;
}

function nameFor(code) {
  return names[code] ?? null;
}

// ---- Classify and condense -----------------------------------------------------

const weapons = {};
const frames = {};
const barriers = {};
const units = {};
const mags = {};
const tools = {};

const WEAPON_FIELDS = [
  "ATPMin", "ATPMax", "ATA", "MST", "MaxGrind",
  "ATPRequired", "ATARequired", "MSTRequired",
  "UsabilityFlags", "Special", "WeaponKind", "ID",
];
const ARMOR_FIELDS = [
  "DFP", "EVP", "DFPRange", "EVPRange",
  "EFR", "EIC", "ETH", "ELT", "EDK",
  "RequiredLevel", "UsabilityFlags", "ID",
];
const UNIT_FIELDS = ["Stat", "StatAmount", "ModifierAmount", "ID"];
const MAG_FIELDS = ["FeedTable", "PhotonBlast", "Activation", "UsabilityFlags", "ID"];
const TOOL_FIELDS = ["Cost", "Amount", "Tech", "ID"];

for (const rawCode of [...itemCodes].sort()) {
  const src = table.Items[rawCode];
  if (rawCode.toUpperCase() !== rawCode) fail(`entry ${rawCode}: unexpected lowercase item code`);
  const typeByte = rawCode.slice(0, 2);
  // Mag entries are keyed by 4-digit codes (TTGG); everything else uses 6 (TTGGII).
  const expectedLen = typeByte === "02" ? 4 : 6;
  if (rawCode.length !== expectedLen) {
    fail(`entry ${rawCode}: expected a ${expectedLen}-hex-digit code for type ${typeByte}`);
  }
  const code = typeByte === "02" ? `${rawCode}00` : rawCode;
  const groupByte = code.slice(2, 4);

  if (typeByte === "00") {
    requireFields(code, src, WEAPON_FIELDS);
    if (src.WeaponKind < 0 || src.WeaponKind >= WEAPON_KIND_COUNT) {
      fail(`weapon ${code}: WeaponKind ${src.WeaponKind} outside expected 0..${WEAPON_KIND_COUNT - 1}`);
    }
    // SaleDivisor is null on unsellable weapons (S-ranks etc.); carried as null.
    if (typeof src.SaleDivisor !== "number" && src.SaleDivisor !== null) {
      fail(`weapon ${code}: SaleDivisor is neither a number nor null`);
    }
    weapons[code] = {
      name: nameFor(code),
      group: parseInt(groupByte, 16),
      weaponKind: src.WeaponKind,
      atpMin: src.ATPMin,
      atpMax: src.ATPMax,
      ata: src.ATA,
      mst: src.MST,
      maxGrind: src.MaxGrind,
      atpRequired: src.ATPRequired,
      ataRequired: src.ATARequired,
      mstRequired: src.MSTRequired,
      usableBy: src.UsabilityFlags,
      special: src.Special,
      stars: starsForId(src.ID),
      saleDivisor: src.SaleDivisor,
    };
  } else if (typeByte === "01" && (groupByte === "01" || groupByte === "02")) {
    requireFields(code, src, ARMOR_FIELDS);
    const target = groupByte === "01" ? frames : barriers;
    target[code] = {
      name: nameFor(code),
      dfp: src.DFP,
      evp: src.EVP,
      dfpRange: src.DFPRange,
      evpRange: src.EVPRange,
      efr: src.EFR,
      eic: src.EIC,
      eth: src.ETH,
      elt: src.ELT,
      edk: src.EDK,
      requiredLevel: src.RequiredLevel,
      usableBy: src.UsabilityFlags,
      stars: starsForId(src.ID),
    };
  } else if (typeByte === "01" && groupByte === "03") {
    requireFields(code, src, UNIT_FIELDS);
    units[code] = {
      name: nameFor(code),
      stat: src.Stat,
      statAmount: src.StatAmount,
      modifierAmount: src.ModifierAmount,
      stars: starsForId(src.ID),
    };
  } else if (typeByte === "02") {
    requireFields(code, src, MAG_FIELDS);
    mags[code] = {
      name: nameFor(code),
      feedTable: src.FeedTable,
      photonBlast: src.PhotonBlast,
      activation: src.Activation,
      usableBy: src.UsabilityFlags,
      stars: starsForId(src.ID),
    };
  } else if (typeByte === "03") {
    requireFields(code, src, TOOL_FIELDS);
    tools[code] = {
      name: nameFor(code),
      cost: src.Cost,
      amount: src.Amount,
      tech: src.Tech,
      stars: starsForId(src.ID),
    };
  } else {
    fail(`entry ${code}: unrecognized type/group combination`);
  }
}

const kinds = { weapons, frames, barriers, units, mags, tools };
for (const [kind, expected] of Object.entries(EXPECTED_COUNTS)) {
  const actual = Object.keys(kinds[kind]).length;
  if (actual !== expected) fail(`classified ${actual} ${kind}, expected ${expected}`);
}

const out = {
  armorSaleDivisor: table.ArmorSaleDivisor,
  shieldSaleDivisor: table.ShieldSaleDivisor,
  unitSaleDivisor: table.UnitSaleDivisor,
  weapons,
  frames,
  barriers,
  units,
  mags,
  tools,
};

// Spot-check reference values (item-parameter-data spec).
const checks = [
  ["weapons", "000100", "name", "Saber"],
  ["weapons", "000100", "atpMin", 40],
  ["weapons", "000100", "atpMax", 55],
  ["weapons", "000100", "ata", 30],
  ["weapons", "000100", "maxGrind", 35],
  ["weapons", "000100", "atpRequired", 30],
  ["weapons", "000100", "weaponKind", 1],
  ["frames", "010100", "name", "Frame"],
  ["frames", "010100", "dfp", 5],
  ["frames", "010100", "evp", 5],
  ["units", "010300", "name", "Knight/Power"],
  ["units", "010300", "statAmount", 5],
  ["mags", "020000", "name", "Mag"],
];
for (const [kind, code, field, expected] of checks) {
  const actual = out[kind]?.[code]?.[field];
  if (actual !== expected) {
    fail(`reference check failed: ${kind}/${code}.${field} = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
console.log(
  `Wrote ${Object.entries(kinds).map(([k, v]) => `${Object.keys(v).length} ${k}`).join(", ")} to ${OUT_PATH}`,
);
