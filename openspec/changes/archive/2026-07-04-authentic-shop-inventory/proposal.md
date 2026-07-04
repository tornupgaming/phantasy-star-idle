# Authentic Shop Inventory

## Why

The gear shops are an acknowledged placeholder (a 10-template curated pool, 4 offers, 5-level bands) and the tool shop is a static consumable list, while newserv provides the complete authentic BB shop system: level-tiered random-set tables for all three shops, per-difficulty weapon tables, and the real price formulas. Porting them replaces placeholder pricing and stock with the authentic PSO experience the project is working towards. Doing so also requires the missing fourth difficulty (Very Hard), whose enemy-stat data is already extracted but which the game does not yet expose.

## What Changes

- **Add the Very Hard difficulty** (`vhard`, between Hard and Ultimate, mesetaMult 3): fourth entry in `DIFFICULTIES`, drop tables re-extracted to include Very Hard rows (the extractor currently strips them), `DropDifficulty` widened, difficulty/label key mismatches reconciled. Enemy stats already ship `vhard` rows; no save migration (type widening only).
- **Port newserv's shop random-set tables** (`armor-shop-random-set.json`, `tool-shop-random-set.json`, `weapon-shop-random-set-{normal,hard,very-hard,ultimate}.json`) as a checked-in extracted dataset, following the existing extraction-script pattern.
- **Replace the placeholder shop generator** with authentic generation: armor shop (armors + shields + units, level-tiered counts and weights, slot rolls, Ultimate subtype bump), tool shop (fixed recovery row + 2 rare-recovery slots + tech disks with authentic level rolls), weapon shop (10–16 weapons with section-ID-weighted type picks, grind with favored-type bonus, specials, dual percent bonuses). Shop difficulty derives from character level: 0–19 Normal, 20–39 Hard, 40–79 Very Hard, 80+ Ultimate (a documented concession — PSO keys shops off the game's difficulty; we key off level). Stock is deterministic per `(characterId, level)` and restocks on level-up, replacing 5-level bands. **BREAKING** for the loot-economy shop contract (stock sizes, restock trigger, pool composition all change).
- **Port authentic pricing** (`ItemParameterTable::price_for_item`): real weapon/armor/unit/tool price formulas replace the placeholder `sellValueFor` and the ×3 shop markup; sell-back becomes buy price ÷ 8. Every item's buy/sell value in the game changes.
- **Item model extensions, ingested for later use**: tech disks become purchasable inventory items carrying technique id + level (unusable for now — learning/casting deferred); weapons gain a tekked/untekked field (shop weapons always tekked; untekked drops and the tekker are future changes); tool shop sells the full authentic recovery roster, including consumables with no implemented effect yet (fluids, sols, etc.) which are buyable and inert.

## Capabilities

### New Capabilities

- `shop-table-data`: checked-in, reproducibly generated dataset of newserv's shop random-set tables (armor/tool/weapon per difficulty), following the drop-table-data extraction pattern.
- `shop-generation`: authentic shop inventory generation for the three Pioneer 2 counters — level-tiered tables, section-ID weighting, attribute rolls, level-derived shop difficulty, deterministic `(characterId, level)` seeding.
- `item-pricing`: authentic buy prices via the ported `price_for_item` formulas and the ÷8 sell-back rule, replacing placeholder sell values shop markup.

### Modified Capabilities

- `loot-economy`: the "Shop purchasing" requirement is rewritten — authentic stock (counts, composition), restock on level-up instead of 5-level bands, prices from item-pricing instead of sellValue×3; sell values change from placeholder formula to buy÷8.
- `drop-table-data`: dataset requirement widens from three difficulties to four (Very Hard rows extracted and carried).
- `run-simulation`: runs can be dispatched at the new Very Hard difficulty (difficulty set widens; no structural change).
- `survival-consumables`: consumable roster expands to the authentic tool-shop recovery items; items whose effects are unimplemented are buyable and inert.

## Impact

- **Engine**: `src/engine/shop.ts` (rewritten), `src/engine/areas.ts` (DifficultyId/DIFFICULTIES), `src/engine/drop-gen.ts` (DropDifficulty), `src/engine/run.ts` (difficulty key reconciliation), `src/engine/items.ts` (Tool tech/level fields, Weapon tekked field), `src/engine/consumables.ts` (roster), `src/engine/game.ts` (shop stock wiring), `src/engine/data/` (new shop-table dataset + regenerated drop tables), `src/engine/data/item-table.ts` (price formulas).
- **Scripts**: new `extract-shop-tables.mjs`; `extract-common-table.mjs` gains Very Hard output.
- **UI**: shop panes must present larger stocks (10–16 weapons, ~20 armor pieces, ~15 tools); difficulty picker gains a fourth button automatically (layout check).
- **Tests**: shop generation/pricing suites, Very Hard drop coverage; existing shop tests rewritten against the new contract.
- **Balance**: repricing every item shifts the economy — a balance-sim sweep before/after is part of the work.
- **No save migration**: no persisted shapes change semantically (shop stock is regenerated; difficulty is not persisted standalone).
