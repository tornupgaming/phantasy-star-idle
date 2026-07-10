# newserv reference map

Local clone: `/home/psmith/projects/newserv/` — open-source PSO private server
(C++). Canonical source for PSO stats, drop rates, items, and game logic.

**Conventions**

- Table versions: `v1`/`v2` = Dreamcast/PC, `v3` = GameCube/Xbox, `v4` = Blue
  Burst. **Prefer the `-v4` (Blue Burst) tables** — most complete.
- The JSON files contain `//` comments — strip them before parsing.
- Data lives in `system/tables/`; the logic that reads each table lives in
  `src/*.hh`/`.cc` (paths below are relative to the newserv root).

## Drop rates

- **Rare drops**: `system/tables/rare-table-v4.json`. Structure:
  `{GameMode: {Episode: {Difficulty: {SectionID: {EnemyType|"Box-<Area>": [[prob, item], ...]}}}}}`.
  Probability is a 32-bit int out of 2^32 (0x80000000 = 50%) or a fraction
  string like `"3/32"`. Logic: `src/RareItemSet.cc`/`.hh`.
- **Common (non-rare) drops**: `system/tables/common-table-v3-v4.json`. Field
  docs are in the comments of `CommonItemSet::Table::RootT` in
  `src/CommonItemSet.hh`. Entries inherit defaults from the previous section
  ID → previous difficulty → Normal mode (cascade explained in the file's
  header comment). Logic: `src/CommonItemSet.cc`.
- **Drop assembly** (random attributes/percentages, grinds, tekker logic):
  `src/ItemCreator.cc`/`.hh`; `system/tables/tekker-adjustment-set.json`.

## Characters and classes

- **Class base stats / growth**: `system/tables/level-table-v4.json` —
  `BaseStats` (12 entries, one per class in the order below), `LevelDeltas`
  (per-level stat gains), `MaxStats`. Logic: `src/LevelTable.cc`/`.hh`.
- **Class names/order** (indexes 0–11): HUmar, HUnewearl, HUcast, RAmar,
  RAcast, RAcaseal, FOmarl, FOnewm, FOnewearl, HUcaseal, FOmar, RAmarl.
  Names + race/role flags (`ClassFlag`): `src/StaticGameData.cc` (~line 292).
- **Section IDs** (indexes 0–9): Viridia, Greenill, Skyly, Bluefull,
  Purplenum, Pinkal, Redria, Oran, Yellowboze, Whitill.
  Canonical list: `src/StaticGameData.cc` (~line 118).

## Enemies

- **Enemy stats** (HP/ATP/ATA/EVP etc. per episode × difficulty):
  `system/tables/battle-params.json`. Logic: `src/BattleParamsIndex.cc`/`.hh`.
- **Enemy type enum** (the names used as keys in the rare table):
  `src/EnemyType.cc`/`.hh`.

### Extracted dataset (this repo)

The game ships a condensed dataset generated from the tables above:
`src/engine/data/enemy-stats.json` (checked in). Regenerate with
`npm run extract:enemy-stats` (newserv path via arg or `NEWSERV_ROOT`,
defaults to `/home/psmith/projects/newserv`).

How it's built (`scripts/extract-battle-params.mjs`):

- Structure of `battle-params.json`: 6 tables (`Episode{1,2,4}-{Online,Solo}`)
  × 4 difficulties × 96 fixed BP slots, each slot holding `Stats`,
  `AttackData`, `ResistData`, `MovementData`. We use the **Solo** tables
  (single-player balancing — matches one dispatched character).
- **Trap**: the `Enemies: [...]` annotations on each slot are episode-agnostic
  (the Ep1 table annotates Ep4-only enemies that happen to share a BP index).
  Never use them. The authoritative enemy → (episode, BP index) mapping is the
  112-row static table in `src/EnemyType.cc`, which the script parses; each
  enemy has *separate* index lists for stats/attack/resist/movement (first
  stats index is used for multi-part bosses).
- The script fails loudly (without writing) on row-count or index-bounds
  mismatches, and asserts reference values (Booma Ep1 Normal HP=60 etc.).
  Output is deterministic — regeneration is byte-identical
  (verified in `tests/enemy-stats.test.ts`).

## Maps and spawns

- **Free-play map data** (BB): `system/maps/bb-v4/`. Per floor variation there
  are up to three files sharing a basename: `<base>e.dat` (enemy sets),
  `<base>o.dat` (object sets — boxes etc.), `<base>.evt` (wave events).
  Free-play `.dat` files are **raw struct arrays with no headers**
  (`EnemySetEntry` = 0x48 bytes, `ObjectSetEntry` = 0x44 bytes; `src/Map.hh`);
  only *quest* DAT files use the sectioned format.
- **Variation tables**: `SetDataTableOn.rel` / `SetDataTableOff.rel` in the
  same dir map area → layout variation → entity variation → file basename
  (parser: `SetDataTable::load_table_t` in `src/Map.cc`; REL footer's
  `root_offset` at file end − 16). Offline (solo) variations use `_off`
  basenames with fewer enemies. The `*Ulti.rel` tables are content-identical
  (minus Episode 4) — ignore them. Not every referenced file ships; free-play
  reachability is capped by `num_free_play_variations_for_floor` (`src/Map.cc`).
- **Set entry → enemy type** (incl. children like Monest's Mothmants, rare
  flags): `SuperMap::add_enemy_and_children` in `src/Map.cc`. Rare variant
  mapping (Hildebear → Hildeblue …): `EnemyTypeDefinition::rare_type` in
  `src/EnemyType.cc`. Floor → area numbers: `default_floor_to_area` in
  `src/Map.cc`; area names: `FloorDefinition` table in `src/StaticGameData.cc`.

### Extracted dataset (this repo)

`src/engine/data/map-spawns.json` (checked in) carries every BB free-play
spawn layout: episode → floors → online/offline variations → waves, each
`{room, wave, enemies: {TYPE: count}}`. Enemy type names match
`enemy-stats.json` keys; only free-play-reachable variations are included.
The rare-variant mapping (Hildebear → Hildeblue …) lives in the typed loader
`src/engine/data/map-spawns.ts` (`rareTypeFor`) for server-style random rolls
(vanilla default 1/512). Regenerate with `npm run extract:map-spawns`
(`scripts/extract-map-spawns.mjs`); deterministic, byte-identical
regeneration is enforced by `tests/map-spawns.test.ts`. Objects/boxes
(`o.dat`) and wave events (`.evt`) are not extracted yet.

Room layout extraction is intentionally split: `room-layouts.json` contains
only the compact offline filename → layout-key provenance needed by synchronous
stage generation, while `room-geometry.json` contains the full x/z coordinates
used by the deferred battle minimap. Regenerate both with
`pnpm extract:room-geometry` (`scripts/extract-room-geometry.mjs`).

## Items

- **Item parameters** (weapon ATP ranges, armor DFP/EVP, stars, class/equip
  requirements, mags, tools): `system/tables/item-parameter-table-bb-v4.json`.
  Logic: `src/ItemParameterTable.cc`/`.hh`.
- **Item names** (item code → display name): `system/tables/names-v4.json`;
  `src/ItemNameIndex.cc`/`.hh`.
- **Mags**: `system/tables/mag-metadata-table-v4.json`.
- **Shop inventories**: `system/tables/weapon-shop-random-set-*.json`,
  `armor-shop-random-set.json`, `tool-shop-random-set.json`;
  `src/ShopRandomSets.hh`.

### Extracted dataset (this repo)

`src/engine/data/item-table.json` (checked in) condenses
`item-parameter-table-bb-v4.json` + `names-v4.json` into standard JSON.
Regenerate with `npm run extract:item-table` (`scripts/extract-item-table.mjs`;
newserv path via arg or `NEWSERV_ROOT`). Notes:

- Kind-segregated by item-code type/group byte: `weapons` (`00GGII`),
  `frames` (`0101II`), `barriers` (`0102II`), `units` (`0103II`),
  `mags` (`02GG` in the source, normalized to `02GG00` — the form
  `names-v4.json` uses), `tools` (`03GGII`). 1,536 entries total.
- `stars` is pre-resolved via `StarValues[entry.ID − StarValueBaseIndex]`
  (0 outside the window, mirroring `ItemParameterTable::get_item_stars`).
- Weapon `usableBy` is an **attribute** bitmask, not per-class — bits
  01 hunter / 02 ranger / 04 force / 08 human / 10 android / 20 newman /
  40 male / 80 female; ALL of a character's attribute bits must be set
  (`src/ItemParameterTable.hh` `Weapon::usability_flags` comment).
- Weapon `weaponKind` (0–18) is the authentic animation/behavior category
  (1 saber … 18 card); weapon `saleDivisor` is `null` for unsellable
  weapons (S-ranks etc.).
- Render/unknown fields (`Skin`, `Trail*`, `Photon`, `Color`, `UnknownA*`)
  and side tables we don't consume (`ItemCombinations`, `MagFeedResults`,
  `SoundRemaps`, …) are pruned.

## Other useful logic

- **Damage / combat-adjacent player math**: `src/PlayerSubordinates.cc`/`.hh`,
  `src/Items.cc` (equip validation).
- **General static data helpers** (names for classes/section IDs/episodes):
  `src/StaticGameData.cc`/`.hh`.
