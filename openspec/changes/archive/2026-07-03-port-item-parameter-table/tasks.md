# Tasks: port-item-parameter-table

## 1. Extraction pipeline

- [x] 1.1 Write `scripts/extract-item-table.mjs`: dialect parser (strip comments, decode hex literals outside strings), load both source files, hard assertions on top-level sections, per-kind field presence, and entry count (1,536) — fail without writing output on any mismatch
- [x] 1.2 Emit `src/engine/data/item-table.json`: kind-segregated (weapons/frames/barriers/units/mags/tools; mag codes normalized 4→6 digits), names joined, stars resolved via `StarValues[ID − StarValueBaseIndex]`, sale divisors inlined, render/unknown fields pruned; deterministic output (sorted keys, fixed field order, 2-space indent)
- [x] 1.3 Add `extract:item-table` npm script; verify regeneration is byte-identical on a second run; spot-check known reference values (Saber `000100`, Frame `010100`) against the source
- [x] 1.4 Document the pipeline in `docs/newserv-reference.md` (source files → dataset mapping)

## 2. Typed loader

- [x] 2.1 Write `src/engine/data/item-table.ts`: `WeaponDef`/`FrameDef`/`BarrierDef`/`UnitDef` types, per-kind code lookups and `all*()` iterators; mags/tools excluded from the exposed API
- [x] 2.2 Add stars→rarity bucket function (0–3 common, 4–8 uncommon, ≥9 rare), preserving raw `stars` on definitions
- [x] 2.3 Add `templateFromCode(code): GearTemplate` adapter (`minAtp`/`spread` from ATP min/max, rarity from bucket, sell value from sale divisor, requirements carried over; unit stat-index → `Partial<Stats>` bonus)
- [x] 2.4 Loader tests: known-code lookups, entry counts per kind, rarity buckets, adapter output validity for one item of each consumed kind

## 3. Item model + equip requirements

- [x] 3.1 Extend `items.ts` with optional `requirements` (atp/ata/mst/level/usableBy) and weapon `group` fields; curated `GEAR` templates unchanged
- [x] 3.2 Add the class-attribute mask table (`classes.ts` id → hunter/ranger/force|human/android/newman|male/female bits per `ItemParameterTable.hh`) used by the `usableBy` check
- [x] 3.3 Enforce requirements in `character.ts` `equip()`: validate against base stats and class bit, reusing the existing error-result shape; requirement-free items behave exactly as before
- [x] 3.4 Tests: stat requirement blocks equip, class bitmask blocks equip, base-stats-only check (equipment bonuses don't satisfy requirements), requirement-free gear unaffected

## 4. Weapon group speed mapping

- [x] 4.1 Add `WEAPON_KIND_ARCHETYPE` lookup in `pacing.ts` covering all 19 `WeaponKind` values, mapping onto the five existing archetypes; existing timings unchanged
- [x] 4.2 Test: every weapon kind in the dataset resolves to an archetype; curated weapons' `comboStepMs` results are unchanged

## 5. Verification

- [x] 5.1 Full test suite + typecheck pass; confirm bundle includes only the pruned dataset (not raw newserv files) and `SAVE_VERSION` is untouched
- [x] 5.2 Remove the stale "No trademarked names" comment in `content.ts` (superseded by authentic naming)
