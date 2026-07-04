# Design — Authentic Shop Inventory

## Context

newserv generates BB shop inventories in `src/ItemCreator.cc:1007-1545` from six JSON tables in `system/tables/`: one armor set, one tool set, and four weapon sets (one per difficulty). All tables are level-tiered weighted-pick tables consumed via a shuffle-and-pop `ProbabilityTable`. Prices come from a separate system, `ItemParameterTable::price_for_item` (`src/ItemParameterTable.cc:2336-2410`).

Our current state (audited in exploration, 2026-07-03):

- `src/engine/shop.ts` is a self-described placeholder: curated 10-template pool, `STOCK_SIZE = 4`, 5-level bands, `sellValue × 3` pricing.
- The bridge to authentic items exists: `src/engine/data/item-table.json` + `templateFromCode()` already convert PSO `TTGGII` codes to engine gear, and drop-gen uses them.
- Item instances already carry grind, special (combat-inert), 5-way percent bonuses (combat-inert), armor slots, and section ID is on the character — all rolled by drop-gen.
- We have three difficulties; enemy-stat data for `vhard` is already extracted but unused; drop-table extraction deliberately strips Very Hard.
- The extracted item table already carries every input `price_for_item` needs (weapon `atpMax`/`maxGrind`/`saleDivisor`, armor `dfp`/`evp`/`requiredLevel` + global divisors, special stars, tool `cost`).

Guiding principle (from the project owner): work *towards* an authentic PSO experience; ingest PSO data even when unused (tech disks, tekked state), and document any deliberate divergence as a formal concession.

## Goals / Non-Goals

**Goals:**

- All three Pioneer 2 shop counters stock authentic, level-appropriate inventory generated from the newserv tables, with authentic attribute rolls (grind, special, bonuses, slots, tech-disk levels).
- Authentic buy prices and ÷8 sell-back, replacing placeholder pricing game-wide.
- Very Hard exists as a full difficulty (runs, enemy stats, drops).
- Deterministic stock: same `(characterId, level)` always produces the same shop.
- Data ingested completely, even where behavior is deferred (tech disks, fluids, tekked flag).

**Non-Goals:**

- Tech disk *use* (learning/casting techniques) — disks are buyable inventory items only.
- Untekked drops and the tekker — only the model field is added; shop weapons are always tekked, drops keep minting tekked.
- Effects for newly stocked consumables without systems (fluids, antidote/antiparalysis, sol/star atomizers) — buyable and inert.
- Difficulty unlock gating — all four difficulties stay freely selectable (ejection remains the emergent gate).
- Mag shop / mags generally.

## Decisions

### D1. Very Hard id is `"vhard"`

`run.ts:392,457` passes `DifficultyId` directly into the enemy-stats lookup whose dataset key is already `"vhard"`. Naming the new id `"vhard"` (label "Very Hard") avoids a mapping layer. Alternative (`"very_hard"` + explicit map) rejected as pure overhead. `mesetaMult: 3` slots into the existing 1/2/4 curve.

The drop-table lookup keys off `diff.label` (`run.ts:194`) while the extractor emits `"VeryHard"` — reconcile by keying drops off `DifficultyId` (or an explicit `dropKey` on `DifficultyDef`) rather than the display label; label-as-key was already fragile.

### D2. Shop difficulty derives from character level

Mapping: level 0–19 → Normal, 20–39 → Hard, 40–79 → Very Hard, 80+ → Ultimate.

**Formal concession**: authentic PSO keys shop stock off the difficulty of the game you are standing in; our hub has no such context between runs, so we key off level. Consequences accepted: a character's shop is independent of the run difficulty they farm, and low-level tiers of the higher-difficulty weapon tables (e.g. Ultimate's `<11/<26/<43/<61` rows) are unreachable by construction. We port the tables whole regardless (ingest-everything).

### D3. Restock seed is `(characterId, level)`, restock on level-up

Seed the per-shop RNG stream with `shop-${kind}-${characterId}-${level}`. Since shop difficulty is a pure function of level, difficulty needs no separate seed input. Restock happens whenever level changes, replacing 5-level bands — closer to newserv (which regenerates per visit keyed on exact level, so composition shifts with the level-tier tables) while staying deterministic and idle-friendly.

Alternative considered: seeding on character *name* + level (owner's initial suggestion) — rejected because names are not unique in the roster; two same-named characters would share shops forever. `Character.id` gives the same determinism without collisions.

### D4. Shop tables ship as an extracted dataset, not runtime JSON reads

New `scripts/extract-shop-tables.mjs` reads the six newserv JSONs plus the hardcoded mapping tables in `ShopRandomSets.cc` (tool-shop `item_defs`, `tech_num_map`; weapon `type_defs`/`type_defs_39`/`type_defs_3A`; `bonus_values`) and emits one checked-in `src/engine/data/shop-tables.json` with a typed loader `shop-tables.ts`. This matches the established pattern (`extract-item-table.mjs`, `extract-common-table.mjs`, `extract-battle-params.mjs`) including exact-count/byte-identical regeneration checks.

Rationale for baking the `.cc` constants into the extractor: those mappings are code in newserv, not data; embedding them (with `file:line` provenance comments) keeps the runtime dataset self-contained. The section-ID-dependent codes `0x39`/`0x3A` and the favored-weapon-type-per-section-ID table are resolved at extraction into per-section lookup arrays.

### D5. Generation logic ports `ItemCreator` faithfully, on our seeded RNG

Port the shuffle-and-pop `ProbabilityTable` (`ItemCreator.cc:12-67`) onto `engine/rng.ts` streams, then the three generators with their exact tier boundaries, counts, duplicate-rejection rules, and quirks:

- **Armor shop** (`:1007-1188`): counts 4/6/7 armors, 4/5/6/7 shields, 0/3/5/6 units at level thresholds 11/26/43; tier index at 11/26/43/61; slot count from the common armor-slot prob table (already in drop-gen); **no DFP/EVP variance** (authentic — shop armor is base-stat); Ultimate subtype bump (+2 at level >99, +3 at >150).
- **Tool shop** (`:1190-1328`): fixed recovery row (all non-0x0F entries always stocked, 6 tiers at 11/26/45/61/100), 2 rare-recovery picks at level ≥11 ("Nothing" reduces count once), 4/5/7 tech disks with levels from divisor/range modes — including the intentionally non-uniform `RANDOM_IN_RANGE` roll (`:1318-1320`), preserved as newserv preserves it.
- **Weapon shop** (`:1330-1545`): 10/12/16 weapons at levels 11/43; tier index per difficulty (5 tiers, or 7 on Ultimate); type picked from `WeaponTypeWeightTables[tier][sectionIdIndex]`; grind from default/favored range (favored when type matches the section ID's favored weapon type), clamped to `maxGrind`; special mode 0/1/2 → `choose_weapon_special` tier roll; bonus1/bonus2 with type reroll on duplicate; ≤2 same weapon-type entries; always tekked.

Where newserv reuses drop-gen helpers (armor slot table, `choose_weapon_special`), we reuse our existing drop-gen ports rather than duplicating.

### D6. Pricing is a new engine module consuming existing item-table fields

Port `price_for_item` into the engine (e.g. `engine/pricing.ts`): weapon `1000·specialStars² + (atpMax+grind)²/saleDivisor · bonusFactor/100`, rare → flat 80, untekked → flat 8; armor `⌊(dfp+evp)²/divisor⌋ + 70·(slots+1)·(requiredLevel+1)`; unit `adjustedStars · unitDivisor`; tool `cost` (tech disk `cost·(level+1)`). Sell-back = `price >> 3`, replacing `itemSellValue`'s placeholder (including its ad-hoc `grind × 10` term — grind now flows through the real formula). The placeholder `sellValueFor` in `item-table.ts` and `GEAR_PRICE_MULT` in `shop.ts` are deleted. All formulas keep integer truncation semantics per project combat-math rules.

Consumable purchases keep flat authentic tool costs (already extracted as `ToolDef.cost`), replacing the hand-set prices in `consumables.ts`.

### D7. Item model ingests deferred-use fields now

- `Tool` gains `tech?: number` and `techLevel?: number`; tech disks are minted as `Tool` instances (kind stays `"tool"` — a new kind would touch every inventory switch for no behavioral gain now; revisit when techniques land).
- `Weapon` gains `tekked: boolean` (shop and drop mints set `true`). No combat/UI behavior change.
- `consumables.ts` roster expands to the authentic tool-shop recovery set (mates, fluids, sol/moon/star atomizers, antidote/antiparalysis, telepipe/trap vision as the tables dictate); entries without implemented effects are flagged inert and simply cannot be consumed. Purchases still land in the `Supply` count map — recovery items stay non-inventory consumables; only tech disks go to `Item[]` inventory as inert tools.

### D8. Very Hard drop data via extractor widening

Add `"VeryHard"` to `extract-common-table.mjs`'s output difficulties (source rows are already read for inheritance), regenerate both drop JSONs, widen `DropDifficulty`. Existing Normal/Hard/Ultimate rows must be byte-identical after regeneration (inheritance is cumulative through Very Hard — verify no drift).

## Risks / Trade-offs

- [Repricing shifts the whole economy — authentic prices may make meseta income wildly over/under-powered for our idle pacing] → run a `balance-sim` sweep (income vs. shop prices at level bands 1–200, all difficulties) before merging; tune `mesetaMult`/drop meseta if needed, never the price formulas.
- [Larger stocks (10–16 weapons, ~20 armor) may overflow the shop pane layout] → UI pass with scrolling; `playcheck` verification of all three counters at low/mid/high level.
- [Port drift from `ItemCreator` subtleties (non-uniform tech levels, duplicate-rejection rules, Ultimate bump)] → golden tests asserting distributions/fixed outputs against hand-verified expectations from the newserv source, with `file:line` citations in test comments.
- [The `.cc`-derived constants in the extractor can silently diverge if newserv updates] → extractor emits provenance comments and the byte-identical regeneration check (same pattern as existing extractors) catches unintended drift.
- [Two "level tier" notions coexist (shop-difficulty bands 20/40/80 vs. table tiers 11/26/43/61/100/151)] → keep them as two named, documented functions; never merge them.
- [Dead Ultimate low-level tiers could hide porting mistakes (untested paths)] → cover them in unit tests directly even though gameplay can't reach them.

## Migration Plan

No save migration: shop stock is regenerated (existing `entry.shop` state is discarded/regenerated on load with the new generator — verify old shape doesn't crash the reader; if it does, bump `SAVE_VERSION` and drop the field in migration), difficulty is not persisted standalone, and new item fields are optional/additive. Old items without `tekked` are treated as tekked.

## Open Questions

- None blocking. Deferred by design: technique learning/casting, tekker/untekked drops, effects for inert consumables.
