/**
 * Extracts authentic PSO Blue Burst enemy stats from a local newserv clone into
 * src/engine/data/enemy-stats.json (enemy-stat-data spec).
 *
 * Sources (read-only, extraction time only):
 *   <newserv>/system/tables/battle-params.json  — Solo tables, per episode × difficulty
 *   <newserv>/src/EnemyType.cc                  — the 112-row enemy definition table:
 *                                                 the ONLY authoritative enemy → BP-index mapping
 *
 * The `Enemies: [...]` annotations inside battle-params.json are episode-agnostic
 * (the Episode 1 table annotates enemies that only exist in Episode 4) and must
 * never be used to associate enemies with stat entries.
 *
 * Usage: node scripts/extract-battle-params.mjs [newserv-root]
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
  "enemy-stats.json",
);

const EXPECTED_DEF_ROWS = 112;
const BP_SLOTS = 96; // 0x60 slots per table (BattleParamsIndex.hh)
const DIFFICULTIES = [
  ["normal", "Normal"],
  ["hard", "Hard"],
  ["vhard", "Very Hard"],
  ["ultimate", "Ultimate"],
];
const EPISODES = [
  ["EP1", "1", "Episode1-Solo"],
  ["EP2", "2", "Episode2-Solo"],
  ["EP4", "4", "Episode4-Solo"],
];

function fail(msg) {
  console.error(`extract-battle-params: ${msg}`);
  console.error("No output written.");
  process.exit(1);
}

// ---- Parse the enemy definition table from EnemyType.cc ------------------------
//
// Each row looks like (whitespace-collapsed):
//   {EnemyType::BOOTA, EP4, 0x60, 0x4D, {0x00}, {0x00, 0x02, 0x04}, {0x00}, {0x00},
//    "BOOTA", "Boota", nullptr},
// Fields: type, episode/flag expression, two ids, {stats indexes}, {attack indexes},
// {resist indexes}, {movement indexes}, "internal name", display name | nullptr,
// ultimate display name | nullptr.

const enemyTypeCc = readFileSync(join(NEWSERV_ROOT, "src", "EnemyType.cc"), "utf8");

const ROW_RE = new RegExp(
  String.raw`\{EnemyType::(\w+),\s*([^,{}]+),\s*(?:0x[0-9A-Fa-f]+|\d+),\s*(?:0x[0-9A-Fa-f]+|\d+),\s*` +
    String.raw`\{([^{}]*)\},\s*\{([^{}]*)\},\s*\{([^{}]*)\},\s*\{([^{}]*)\},\s*` +
    String.raw`"(\w+)",\s*(?:"([^"]*)"|nullptr),\s*(?:"([^"]*)"|nullptr)`,
  "g",
);

const defs = [];
for (const m of enemyTypeCc.matchAll(ROW_RE)) {
  const [, type, flags, statsIdx, , resistIdx, , internalName, displayName, ultimateName] = m;
  const episodes = EPISODES.filter(([flag]) => flags.includes(flag)).map(([, ep]) => ep);
  defs.push({
    type,
    internalName,
    displayName: displayName ?? null,
    ultimateName: ultimateName ?? null,
    episodes,
    statsIndexes: statsIdx
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x)),
    resistIndexes: resistIdx
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x)),
  });
}

if (defs.length !== EXPECTED_DEF_ROWS) {
  fail(
    `parsed ${defs.length} enemy definition rows from EnemyType.cc, expected ${EXPECTED_DEF_ROWS} — upstream format may have changed`,
  );
}
for (const d of defs) {
  if (d.type !== d.internalName) {
    fail(`definition ${d.type} has mismatched internal name "${d.internalName}"`);
  }
}

// ---- Join against the Solo battle-params tables --------------------------------

const battleParams = JSON.parse(
  readFileSync(join(NEWSERV_ROOT, "system", "tables", "battle-params.json"), "utf8"),
);

const out = {};
for (const def of defs.sort((a, b) => (a.type < b.type ? -1 : 1))) {
  if (def.episodes.length === 0 || def.statsIndexes.length === 0) continue;
  const statsIndex = def.statsIndexes[0]; // multi-part bosses: first index is canonical
  const resistIndex = def.resistIndexes[0] ?? statsIndex;

  const perEpisode = {};
  for (const [, epKey, tableName] of EPISODES) {
    if (!def.episodes.includes(epKey)) continue;
    const table = battleParams[tableName];
    if (!table) fail(`missing table ${tableName} in battle-params.json`);

    const perDifficulty = {};
    for (const [diffKey, diffName] of DIFFICULTIES) {
      const entries = table[diffName];
      if (!entries) fail(`missing difficulty "${diffName}" in ${tableName}`);
      if (statsIndex >= entries.length || statsIndex >= BP_SLOTS) {
        fail(`${def.type}: stats index ${statsIndex} out of bounds for ${tableName}/${diffName}`);
      }
      if (resistIndex >= entries.length) {
        fail(`${def.type}: resist index ${resistIndex} out of bounds for ${tableName}/${diffName}`);
      }
      const s = entries[statsIndex].Stats;
      const r = entries[resistIndex].ResistData;
      perDifficulty[diffKey] = {
        hp: s.HP,
        atp: s.ATP,
        dfp: s.DFP,
        ata: s.ATA,
        evp: s.EVP,
        lck: s.LCK,
        esp: s.ESP,
        exp: s.EXP,
        meseta: s.Meseta,
        efr: r.EFR,
        eic: r.EIC,
        eth: r.ETH,
        elt: r.ELT,
        edk: r.EDK,
        evpBonus: r.EVPBonus,
        dfpBonus: r.DFPBonus,
      };
    }
    perEpisode[epKey] = perDifficulty;
  }

  const entry = { displayName: def.displayName ?? def.type, episodes: def.episodes, perEpisode };
  if (def.ultimateName) entry.ultimateName = def.ultimateName;
  out[def.type] = entry;
}

// Spot-check reference values (enemy-stat-data spec, Solo Episode 1).
const checks = [
  ["BOOMA", "1", "normal", "hp", 60],
  ["BOOMA", "1", "normal", "atp", 80],
  ["DRAGON", "1", "normal", "hp", 1300],
  ["DRAGON", "1", "normal", "exp", 350],
];
for (const [type, ep, diff, field, expected] of checks) {
  const actual = out[type]?.perEpisode?.[ep]?.[diff]?.[field];
  if (actual !== expected) {
    fail(`reference check failed: ${type} ep${ep} ${diff} ${field} = ${actual}, expected ${expected}`);
  }
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
console.log(
  `Wrote ${Object.keys(out).length} enemies (from ${defs.length} defs) to ${OUT_PATH}`,
);
