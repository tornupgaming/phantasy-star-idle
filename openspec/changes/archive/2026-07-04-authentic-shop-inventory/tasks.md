# Tasks — Authentic Shop Inventory

## 1. Very Hard difficulty

- [x] 1.1 Add `"vhard"` to `DifficultyId` and a Very Hard entry (label "Very Hard", mesetaMult 3) to `DIFFICULTIES` in `src/engine/areas.ts`, ordered between Hard and Ultimate
- [x] 1.2 Rekey the drop-table lookup off `DifficultyId` (or an explicit `dropKey` on `DifficultyDef`) instead of `diff.label` in `src/engine/run.ts:194`; verify `instantiateEnemy` receives `"vhard"` unchanged (`run.ts:392,457`)
- [x] 1.3 Add `"VeryHard"` to the output difficulties in `scripts/extract-common-table.mjs`, widen `DropDifficulty` in `src/engine/drop-gen.ts`, regenerate both drop-table JSONs, and verify existing Normal/Hard/Ultimate rows are unchanged (also fixed pre-existing extractor drift: the box-area scan still expected the removed `boxDropTableId` field)
- [x] 1.4 Tests: Very Hard drop-context coverage (`tests/very-hard.test.ts`: source-exact VeryHard cells, inherited weapon row, vhard stat rows, mesetaMult 3) and the four-button difficulty picker assertion in `tests/ui-smoke.test.ts`

## 2. Shop table dataset

- [x] 2.1 Write `scripts/extract-shop-tables.mjs` reading the six newserv shop JSONs, emitting `src/engine/data/shop-tables.json` with a byte-identical regeneration check; add an `extract:shop-tables` npm script
- [x] 2.2 Bake the newserv code constants into the extractor with `file:line` provenance comments: tool `item_defs` + `tech_num_map` (ShopRandomSets.cc:324-344), weapon `type_defs`/`type_defs_39`/`type_defs_3A` (:518-619), `bonus_values` (:621-622), favored weapon type per section ID (TekkerAdjustmentSet.cc:131-145)
- [x] 2.3 Write the typed loader `src/engine/data/shop-tables.ts` (armor/shield/unit tier tables; tool recovery/rare/tech-disk tables with the three level modes; per-difficulty weapon tables; 0x39/0x3A resolution helpers)
- [x] 2.4 Tests: `tests/shop-tables.test.ts` — hand-verified source cells, constant resolution against the item table, level-mode coverage, byte-identical regeneration

## 3. Item model ingestion

- [x] 3.1 Add `tech`/`techLevel` to `Tool` and `tekked: boolean` to `Weapon` in `src/engine/items.ts` (`isTekked()` treats missing as true); `tekked: true` set once in `templateFromCode`, the single point all weapon mints flow through
- [x] 3.2 Expand the consumable roster in `src/engine/consumables.ts` to the authentic tool-shop recovery set (fluids, sol/star atomizers, antidote/antiparalysis, telepipe, trap vision) with kind `"inert"` and authentic codes; survival logic already allowlists heal/revive ids so inert entries are never auto-consumed
- [x] 3.3 UI: tech-disk meta line (`tech disk · Lv.N`), inert-kind icon/flavor/detail text in tool shop pane

## 4. Authentic pricing

- [x] 4.1 Implement `src/engine/pricing.ts` porting `price_for_item` (weapon/armor/unit/tool branches, rare and untekked flat prices, truncation semantics preserved; mags not modeled)
- [x] 4.2 Replace `itemSellValue`/`sellValueFor` with `sellPrice = price >> 3` (templates stamped via `withAuthenticSell`); delete `GEAR_PRICE_MULT`; consumable prices wired to authentic tool costs (Dimate 300, Trimate 2000, Moon 500, grinder 5000)
- [x] 4.3 Tests: `tests/pricing.test.ts` — hand-verified Saber/Frame/Barrier/unit/disk prices, untekked 8 / rare 80 flats, ÷8 sell-back
- [x] 4.4 Balance-sim sweep run: pacing healthy (tier gear <2 runs, grinder 6.5→0.76 runs early→mid); no `mesetaMult`/drop tuning needed; regression found and fixed — `DEFAULT_FILTER.autoSellBelow` 300→550 (inventory flooding under new sell values); economy-band bounds retuned to measured means ±30% (forest/8 ≈759 → [530,990], mines/30 ≈15.1k → [10500,19500]). Hard/vhard income unverifiable: the harness's strongest curated weapon walls at those difficulties (harness gap, noted for future work)

## 5. Shop generation engine

- [x] 5.1 Port the shuffle-and-pop `ProbabilityTable` (ItemCreator.cc:12-67; forward Fisher-Yates + pop-from-end) onto seeded RNG streams in `src/engine/shop.ts`
- [x] 5.2 Level→shop-difficulty mapping (0–19/20–39/40–79/80+) and `(characterId, level)` stream keying; restock on level change; `levelBand` removed; `ShopStocks` gains the tool counter; `SAVE_VERSION` 4→5 with regenerate-stocks migration
- [x] 5.3 Armor shop port (tiers 11/26/43/61, counts 4/6/7 + 4/5/6/7 (shield cut at 42) + 0/3/5/6, duplicate rejection, slot roll via drop-gen's `ArmorSlotCountProbTable`, no DFP/EVP variance, Ultimate +2/+3 subtype bump)
- [x] 5.4 Tool shop port (fixed recovery row per 11/26/45/61/100 tiers, 2 rare-recovery picks with "Nothing" handling, tech disks with all three level modes incl. the non-uniform clamp-low range roll; concession: one grinder offer always stocked — core meta loop)
- [x] 5.5 Weapon shop port (per-difficulty tiers incl. Ultimate's 7, section-ID weighted type picks with 0x39/0x3A resolution, default/favored grind, special modes → `choose_weapon_special` port, dual bonuses with pop-until-different-type reroll and clamp-low magnitude quirk, ≤2 same-type cap, always tekked)
- [x] 5.6 `SHOP_POOLS`/`STOCK_SIZE` removed; buying routed through authentic prices (gear + one-shot tool items → inventory via `buyGear`/`buyToolItem`; consumables/grinders → supply counts)
- [x] 5.7 Save migration: v4 saves regenerate stocks into the new shape (`tests/migration.test.ts` covers v4→v5 and legacy-tekked reads)
- [x] 5.8 Tests: `tests/shop.test.ts` (23) — determinism, restock on level-up, boundary-level counts, section-ID pool membership, favored-grind ranges, ≤2-type cap, dead Ultimate tiers asserted directly, disk levels/pricing, Scape Doll as inert stock

## 6. UI and verification

- [x] 6.1 Shop panes: `.shop-list` already scrolls (max-height + overflow auto); offers show authentic prices, item meta shows grind/special/bonuses/slots; tool counter renders consumables, grinder, and one-shot items (tech disks, Scape Doll) with a buy path each
- [x] 6.2 Test suites rewritten against the new contract: `shop.test.ts`, `migration.test.ts` (v4→v5), `loot.test.ts`, `item-table.test.ts`, `store.test.ts`, `ui-smoke.test.ts`, `economy-band.test.ts` (retuned bands)
- [x] 6.3 `playcheck` pass (headless Chromium): all three counters render authentic stock at correct counts/prices, purchases (consumable/weapon/tech disk) deduct meseta with shopkeeper dialogue reactions, four-difficulty picker works and a Very Hard run dispatches against authentic vhard stats; no overflow, no undefined names; key screenshots reviewed
- [x] 6.4 Full `vitest run` green (34 files / 287 tests) with clean typecheck; determinism/replay suites unaffected; extractors re-run idempotently
