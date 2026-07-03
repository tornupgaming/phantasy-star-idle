# Tasks — authentic drop generation

## 1. Extraction pipeline (drop-table-data)

- [x] 1.1 Write `scripts/extract-common-table.mjs`: parse `common-table-v3-v4.json` (JSONC), resolve the inheritance chain (previous section ID → previous difficulty → Normal mode), slice to Ep1 / Normal mode / {Normal, Hard, Ultimate} / 10 section IDs, carry only the tables listed in design D1, zero tech-disk weights in tool-class tables (D6), and emit `src/engine/data/common-drop-table.json`; fail loudly on missing keys or shape drift
- [x] 1.2 Add the `statsType` → newserv `EnemyType` → `rt_index` mapping to the extraction; emit per-enemy `rtIndex` (into the common-drop dataset or an enemy-side dataset) and validate every wired enemy resolves (including Al Rappy / Nar Lily — resolve design open question)
- [x] 1.3 Extend the script (or add a sibling) to slice `rare-table-v4.json`: same scenario slice, normalize probabilities (2^32 ints and fraction strings), resolve item codes against `item-table.json`, drop non-gear specs, validate `Where` keys against wired enemies/box areas, and emit `src/engine/data/rare-drop-table.json`
- [x] 1.4 Wire `extract:common-table` (and rare) into `package.json` scripts; confirm regeneration is byte-identical run-to-run
- [x] 1.5 Add dataset spot-check tests: hand-verified table cells vs the newserv source (fully-specified scenario + an inherited scenario), probability normalization equivalence, tech-disk weights all zero, every rare spec's code resolves to gear

## 2. Loader and item model

- [x] 2.1 Expose tool definitions from `src/engine/data/item-table.ts` (code, name, sell value); keep mags hidden (item-parameter-data delta)
- [x] 2.2 Extend `items.ts`: optional weapon `bonuses` (native/aBeast/machine/dark/hit) and `special`; frame/barrier `slots`; `stars` and PSO `code` on generated items; new inert `Tool` item kind with sell value; star-bucket rarity reused from the loader
- [x] 2.3 Update item sell-value and loot-filter paths (`itemSellValue`, `filterItem`) to handle tool items and the new fields

## 3. Drop generator (drop-generation)

- [x] 3.1 Create `src/engine/drop-gen.ts` with typed access to the resolved datasets and the index-probability sampler (port of `get_rand_from_weighted_tables`, seeded `Rng`-backed)
- [x] 3.2 Implement `area_norm` mapping for wired areas including the boss-floor rule (Dragon → Caves 1) as an explicit map (design D8)
- [x] 3.3 Implement the enemy pipeline: drop-anything roll → rare-spec rolls → item class → per-class generation; and the box pipeline: rare roll → box item-class table (meseta/empty included)
- [x] 3.4 Implement common weapon generation: type/subtype/area gating, grind, special (mult + percent), attribute bonuses with dedup — mirroring `ItemCreator.cc` incl. integer truncation
- [x] 3.5 Implement common armor/shield generation (type formula with bias, slot count, DFP/EVP variance within dataset ranges — confirm range interpretation vs newserv, design open question) and unit generation (area max-stars uniform pick)
- [x] 3.6 Implement tool and meseta outcomes: mates/Moon Atomizer → consumable supply, grinders → grinder count, other tools → inert tool items; enemy/box meseta ranges with `mesetaMult`
- [x] 3.7 Implement rare minting: item-code lookup, rare (spec-5) bonus rolls with random area column, rare grind, forced `rare` rarity
- [x] 3.8 Generator tests: deterministic replay (same seed → identical drops), generated weapons always resolve to valid codes with legal grinds, subtype area gating, unit star cap, distribution sanity (e.g. drop-anything rates match table values within tolerance over N trials)

## 4. Run integration

- [x] 4.1 Thread the character's `sectionId` into `RunInput`/stage context; remove `DifficultyDef.dropTier`
- [x] 4.2 Replace `rollDrop`/`getDropTable` call sites in `run.ts` with the generator (enemy kills use `rtIndex`; boxes use area); remove the stat-row meseta kill award
- [x] 4.3 Delete `DROP_TABLES`, `GEAR` templates, and the now-dead `DropTable`/`rollDrop` machinery from `content.ts`/`loot.ts`; drop `AreaDef.boxDropTableId`
- [x] 4.4 Extend run collection/report for inert tool items; verify battle-log loot events carry the new drop kinds
- [x] 4.5 Update/extend run determinism and no-`Math.random` tests to cover the new path end-to-end

## 5. Persistence

- [x] 5.1 Bump `SAVE_VERSION` to 4; migrate v3 saves in place (optional item fields default absent; legacy template items survive; regenerate shop stocks that reference removed `GEAR` templates)
- [x] 5.2 Save/load round-trip test: item with bonuses/special/slots/stars and inert tools persist intact; v3 → v4 migration test

## 6. UI

- [x] 6.1 Render generated variance in item detail/tooltips: grind, attribute bonuses, special, slots, stars
- [x] 6.2 Show inert tool items in inventory (name, sell value, icon fallback) and in the run report
- [x] 6.3 Loot filter settings still function against the new rarity labels (no redesign)

## 7. Economy retune

- [x] 7.1 Re-baseline income: simulate representative runs per difficulty/section ID and record meseta + sellable-value per run
- [x] 7.2 Retune `autoSellBelow` default, `mesetaMult`, and shop prices against the new income shape; add a distribution sanity test asserting average meseta/run stays within the tuned band
- [x] 7.3 Play-check a Normal Forest run and an Ultimate run end-to-end (drops look authentic, filter routes sensibly, report totals plausible)
