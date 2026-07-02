/**
 * Extracts authentic PSO:BB attack-animation frame data from the pinned
 * pioneer2.net wikitext snapshot into src/engine/data/frame-data.json
 * (attack-frame-data spec).
 *
 * Source (read-only, extraction time only):
 *   scripts/data/frame-data.wiki — raw wikitext of
 *   https://wiki.pioneer2.net/w/Game_mechanics/Frame_data (see file header)
 *
 * The wiki measures, per animation rig × weapon kind × attack tier, the frame
 * counts (30 fps) of combo steps 1–3 in two flavors — "Combo" (the attack
 * chains into a next step) and "Full" (the combo ends here) — at two speed
 * anchors: +40% animation speed ("V101", complete for the male rig) and 0%
 * (fragmentary: only kinds the community measured). Rigs other than male are
 * sparse overrides; a missing rig/kind means "same as male" (wiki convention,
 * resolved at runtime by the accessor, never baked into this dataset).
 *
 * Unmeasured 0% cells are reconstructed as round(v101 × medianRatio[position]),
 * where the per-position median 0%/40% ratios come from every rig/kind/tier
 * measured at both anchors; reconstructed tiers carry `baseReconstructed: true`
 * (design D2). Measured cells are always the wiki's exact values.
 *
 * Exotic per-weapon animations (L&K38 Combat, Master Raven, Last Swan) are
 * out of scope and skipped.
 *
 * Usage: node scripts/extract-frame-data.mjs
 *
 * The output is deterministic: sorted keys, fixed field order, 2-space indent.
 * Regenerating against the same snapshot must be byte-identical.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = join(HERE, "data", "frame-data.wiki");
const OUT_PATH = join(HERE, "..", "src", "engine", "data", "frame-data.json");

const POSITIONS = ["full1", "combo1", "full2", "combo2", "full3"];
const TIERS = { Normal: "normal", Heavy: "heavy" };

// Wiki link text → engine WeaponKind name (items/pacing vocabulary).
const KIND_BY_LINK = {
  "Fists": "fist",
  "Saber": "saber", "Sabers": "saber",
  "Sword": "sword", "Swords": "sword",
  "Daggers": "dagger",
  "Partisans": "partisan",
  "Slicers": "slicer",
  "Handgun": "handgun", "Handguns": "handgun",
  "Rifles": "rifle",
  "Mechguns": "mechgun",
  "Shots": "shot",
  "Canes": "cane",
  "Rods": "rod",
  "Wands": "wand",
  "Claws": "claw",
  "Double Sabers": "double-saber",
  "Twin Swords": "twin-sword",
  "Katanas": "katana",
  "Launchers": "launcher",
  "Cards": "card",
};
const SKIPPED_LINKS = new Set(["L&K38 Combat", "Master Raven", "Last Swan"]);
const ALL_KINDS = [...new Set(Object.values(KIND_BY_LINK))];

// Wiki rig captions → engine rig names.
const RIG_BY_CAPTION = {
  "Male": "male",
  "Female": "female",
  "HUcaseal": "hucaseal",
  "RAmarl": "ramarl",
  "FOmar": "fomar",
  "FOmarl": "fomarl",
};

function fail(msg) {
  console.error(`extract-frame-data: ${msg}`);
  console.error("No output written.");
  process.exit(1);
}

// ---- Parse the nine weapon frame-data wikitables ---------------------------------

const wikitext = readFileSync(SRC_PATH, "utf8");
const weaponsSection = wikitext.slice(0, wikitext.indexOf("==Techniques=="));
if (weaponsSection.length === wikitext.length) fail("could not find ==Techniques== delimiter");

// anchors.v101 / anchors.base: {rig: {kind: {tier: {full1..full3}}}}
const anchors = { v101: {}, base: {} };

// A data cell may carry a style prefix (`style="..."|29 (+2)`) and a delta
// annotation vs. the male rig; only the leading integer is the frame count.
function cellValue(cell, context) {
  const bar = cell.lastIndexOf("|");
  const body = (bar >= 0 ? cell.slice(bar + 1) : cell).trim();
  if (body === "") return null; // exotics leave combo cells empty
  const m = body.match(/^(\d+)(\s*\([+-]\d+\))?$/);
  if (!m) fail(`unparseable cell "${cell}" in ${context}`);
  return Number(m[1]);
}

const tables = weaponsSection.split("\n{|").slice(1);
let parsedTables = 0;
for (const table of tables) {
  const caption = table.match(/^\|\+[^|]*\|\s*\d+\.\s*(.+?),\s*(no )?V101:?\s*$/m);
  if (!caption) continue;
  const rig = RIG_BY_CAPTION[caption[1]];
  if (!rig) fail(`unknown rig caption "${caption[1]}"`);
  const anchor = caption[2] ? "base" : "v101";
  parsedTables += 1;

  const rows = table.split("\n|-");
  let kind = null; // persists across rows (weapon cells span Normal+Heavy)
  let skipKind = false;
  for (const row of rows) {
    const cells = row
      .split("\n")
      .filter((l) => l.startsWith("|") && !/^\|[}+-]/.test(l))
      .map((l) => l.slice(1).trim());
    // Row shape: [category?] [weapon-link?] tier v1 v2 v3 v4 v5
    let i = 0;
    while (i < cells.length && !(cells[i] in TIERS)) {
      const link = cells[i].match(/\[\[([^\]]+)\]\]/);
      if (link) {
        skipKind = SKIPPED_LINKS.has(link[1]);
        if (!skipKind) {
          kind = KIND_BY_LINK[link[1]];
          if (!kind) fail(`unknown weapon link "${link[1]}" (${rig}, ${anchor})`);
        }
      }
      i += 1; // category cells ("Melee", "Ranged", "Technique") are skipped
    }
    if (i === cells.length) continue; // header/blank row
    if (skipKind) continue;
    if (!kind) fail(`tier row before any weapon link (${rig}, ${anchor})`);
    const tier = TIERS[cells[i]];
    const values = cells.slice(i + 1);
    if (values.length !== POSITIONS.length) {
      fail(`${rig}/${kind}/${tier} (${anchor}): expected 5 value cells, got ${values.length}`);
    }
    const entry = {};
    for (let p = 0; p < POSITIONS.length; p += 1) {
      const v = cellValue(values[p], `${rig}/${kind}/${tier} (${anchor})`);
      if (v === null) fail(`${rig}/${kind}/${tier} (${anchor}): empty cell for ${POSITIONS[p]}`);
      entry[POSITIONS[p]] = v;
    }
    ((anchors[anchor][rig] ??= {})[kind] ??= {})[tier] = entry;
  }
}
if (parsedTables !== 9) fail(`parsed ${parsedTables} weapon tables, expected 9`);

const maleV101 = anchors.v101.male ?? {};
for (const k of ALL_KINDS) {
  if (!maleV101[k]?.normal || !maleV101[k]?.heavy) {
    fail(`male V101 table missing kind "${k}" — it is the complete baseline`);
  }
}

// ---- Reconstruct unmeasured 0% cells (design D2) ---------------------------------

// Per-position median of base/v101 ratios over every rig/kind/tier measured at
// both anchors (the six male kinds + female saber + HUcaseal dagger).
const ratioSamples = Object.fromEntries(POSITIONS.map((p) => [p, []]));
let dualMeasured = 0;
for (const [rig, kinds] of Object.entries(anchors.base)) {
  for (const [kind, tiers] of Object.entries(kinds)) {
    for (const [tier, baseEntry] of Object.entries(tiers)) {
      const v101Entry = anchors.v101[rig]?.[kind]?.[tier];
      if (!v101Entry) continue;
      dualMeasured += 1;
      for (const p of POSITIONS) ratioSamples[p].push(baseEntry[p] / v101Entry[p]);
    }
  }
}
if (dualMeasured < 10) fail(`only ${dualMeasured} dual-measured tiers — too few for ratio medians`);

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const medianRatio = Object.fromEntries(POSITIONS.map((p) => [p, median(ratioSamples[p])]));

// ---- Assemble output: {rig: {kind: {tier: {v101, base, baseReconstructed}}}} ------

const rigs = {};
for (const rig of Object.keys(anchors.v101).sort()) {
  rigs[rig] = {};
  for (const kind of Object.keys(anchors.v101[rig]).sort()) {
    rigs[rig][kind] = {};
    for (const tier of ["normal", "heavy"]) {
      const v101 = anchors.v101[rig][kind][tier];
      if (!v101) fail(`${rig}/${kind}: missing ${tier} tier at v101 anchor`);
      const measuredBase = anchors.base[rig]?.[kind]?.[tier] ?? null;
      const base =
        measuredBase ??
        Object.fromEntries(POSITIONS.map((p) => [p, Math.round(v101[p] * medianRatio[p])]));
      rigs[rig][kind][tier] = { v101, base, baseReconstructed: measuredBase === null };
    }
  }
}
// Base-anchor measurements for rig/kind/tiers with no v101 entry (none exist in
// the current snapshot, and the accessor pairs anchors per rig) are rejected so
// a future snapshot change is a conscious decision, not silent data loss.
for (const [rig, kinds] of Object.entries(anchors.base)) {
  for (const kind of Object.keys(kinds)) {
    if (!anchors.v101[rig]?.[kind]) {
      fail(`${rig}/${kind} measured at 0% but not at +40% — extend the output shape first`);
    }
  }
}

const out = {
  source: "wiki.pioneer2.net/w/Game_mechanics/Frame_data (pinned: scripts/data/frame-data.wiki)",
  fps: 30,
  medianRatio,
  rigs,
};

// Spot-check reference values (attack-frame-data spec).
const checks = [
  ["male", "saber", "normal", "v101", "full1", 29],
  ["male", "saber", "normal", "base", "full1", 32],
  ["male", "handgun", "normal", "v101", "combo1", 14],
  ["male", "handgun", "normal", "base", "combo1", 18],
  ["male", "sword", "heavy", "v101", "full3", 43],
  ["female", "saber", "normal", "base", "full3", 46],
  ["hucaseal", "dagger", "heavy", "v101", "combo2", 18],
];
for (const [rig, kind, tier, anchor, pos, expected] of checks) {
  const actual = rigs[rig]?.[kind]?.[tier]?.[anchor]?.[pos];
  if (actual !== expected) {
    fail(`reference check failed: ${rig}/${kind}/${tier}.${anchor}.${pos} = ${actual}, expected ${expected}`);
  }
}
for (const [rig, kind, tier] of [
  ["male", "saber", "normal"],
  ["female", "saber", "heavy"],
  ["hucaseal", "dagger", "normal"],
]) {
  if (rigs[rig][kind][tier].baseReconstructed) {
    fail(`${rig}/${kind}/${tier} has measured 0% data but was marked reconstructed`);
  }
}
if (!rigs.male.rifle.normal.baseReconstructed) {
  fail("male/rifle/normal 0% is not wiki-measured and must be marked reconstructed");
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
const rigCount = Object.keys(rigs).length;
const tierCount = Object.values(rigs).reduce(
  (n, kinds) => n + Object.values(kinds).reduce((m, tiers) => m + Object.keys(tiers).length, 0),
  0,
);
console.log(`Wrote ${rigCount} rigs, ${tierCount} kind-tiers (${dualMeasured} dual-measured) to ${OUT_PATH}`);
