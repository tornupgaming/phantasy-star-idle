# Authentic drop generation

## Why

Drops are the last placeholder system in the engine: enemies and boxes roll from ~15 hand-invented gear templates in `content.ts`, while the authentic PSO Blue Burst item dataset (`item-table.json`) is already extracted and barely used. Porting newserv's common/rare drop generation makes loot procedural and authentic (weapon subtypes by area, grinds, % bonuses, specials, armor slots, unit stars), and finally activates the character-bound section ID that was added in anticipation of this port.

## What Changes

- New extraction script resolves the inheritance chain in newserv's `common-table-v3-v4.json` offline and emits a checked-in dataset sliced to Episode 1, Normal game mode, the game's three difficulties (Normal/Hard/Ultimate), and all 10 section IDs; a companion slice of `rare-table-v4.json` covers rare gear specs for the wired enemies and box areas.
- New pure engine module (`drop-gen.ts`) ports newserv's `ItemCreator` common-item pipeline: per-enemy `rt_index` drop-anything/item-class/meseta tables, per-area weapon type/subtype/grind/special/bonus generation, armor/shield type + slots, unit stars, tool class tables, and box item-class tables. All rolls go through the run's seeded RNG (deterministic replays preserved).
- Rare drops included, scoped to gear item codes only: the per-spec probability roll happens after the drop-anything check and before common item-class selection; rare tools/mags, kill counters, and unsealable logic are out of scope.
- Item model grows fields the generator produces — weapon attribute bonuses (native/A.Beast/machine/dark/hit) and special, armor/frame slots, unit star variance. Stored and displayed, **not** wired into combat yet.
- Tool drops mint inert, sellable tool items from the already-extracted tool table (fluids, sols, atomizers, antidotes, etc.); only mates and Moon Atomizers remain usable consumables. Tech disks are excluded (re-rolled) since no technique system exists.
- **BREAKING** (authenticity): enemy meseta is no longer a guaranteed per-kill award from the battle-param stat row; it drops via `enemy_rt_index_meseta_ranges` gated by the drop-anything probability. Kills can pay nothing, as in PSO.
- Star count maps to the existing rarity labels (loot filter keeps working); rare-table drops are always `rare`.
- Hand-authored `DROP_TABLES` and `GEAR` placeholder templates are removed; `run.ts` calls the new generator with `(sectionId, difficulty, area)` context.
- Save shape changes (item fields, tool inventory) → `SAVE_VERSION` bump to 4 with migration decision.
- Explicit economy retune task: `autoSellBelow` default, `mesetaMult`, and shop pricing revisited against the new income shape.

## Capabilities

### New Capabilities

- `drop-table-data`: reproducible extraction of resolved common-drop tables and sliced rare-drop specs from the newserv clone into checked-in engine datasets, plus per-enemy `rt_index` mapping (mirrors the `item-parameter-data` pipeline pattern).
- `drop-generation`: the procedural drop generator — per-kill and per-box item generation from the authentic tables, keyed by section ID, difficulty, and area, with the rare-spec check and star→rarity mapping, fully seeded-RNG deterministic.

### Modified Capabilities

- `loot-economy`: "Drop generation" requirement changes from area/difficulty drop *tables* to the authentic generator keyed by (section ID, difficulty, area); tool items become inert sellable inventory drops; meseta becomes drop-based.
- `enemy-stat-data`: the "EXP and meseta awards from the dataset row" requirement narrows to EXP only; meseta moves to drop generation.
- `item-parameter-data`: the typed loader additionally exposes tool definitions (currently extracted but deliberately hidden) and item-code lookup for rare-drop minting.

## Impact

- **Engine**: new `drop-gen.ts`; `loot.ts` (DropTable/rollDrop replaced), `content.ts` (DROP_TABLES/GEAR removed, enemies gain `rt_index`), `run.ts` (drop call sites, meseta award removal), `items.ts` (new item fields), `areas.ts` (`area_norm` mapping incl. boss-floor rule), `save.ts` (version 4), `shop.ts`/`pacing.ts` (retune).
- **Data**: new `scripts/extract-common-table.mjs` (+ rare slice), new JSON under `src/engine/data/`; extends `extract-item-table.mjs` exposure of tools.
- **UI**: item detail/tooltip rendering for bonuses/special/slots/stars; inert tool items in inventory lists.
- **Character/creation**: no changes needed — `Character.sectionId` already exists and becomes live.
- **Tests**: determinism test unaffected (all rolls via seeded RNG); new dataset spot-check tests against newserv source values; distribution sanity tests.
