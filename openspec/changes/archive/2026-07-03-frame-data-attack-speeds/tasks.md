# Tasks — frame-data attack speeds

## 1. Data pipeline

- [x] 1.1 Check in the pinned wikitext snapshot as `scripts/data/frame-data.wiki` with a provenance header (source URL, retrieval date 2026-07-03)
- [x] 1.2 Write `scripts/extract-frame-data.mjs`: parse weapon tables 1–9 (rig × kind × tier × step, Combo/Full, both anchors), normalizing wiki kind names to the 19 `WeaponKind` names and skipping exotic per-weapon rows (L&K38 Combat, Master Raven, Last Swan)
- [x] 1.3 Implement 0%-cell reconstruction in the script: compute per-position median 0%/40% ratios from all dual-measured cells, fill missing 0% cells as `round(frames40 × ratio)`, mark them `reconstructed: true`
- [x] 1.4 Emit `src/engine/data/frame-data.json`, add `extract:frame-data` npm script, verify re-runs are byte-identical
- [x] 1.5 Extraction tests: known measured cells (e.g. Male saber N1 full 29@40% / 32@0%, Male handgun N1 combo 14@40% / 18@0%), reconstruction marking, all-19-kinds coverage at both anchors

## 2. Frame-data engine module

- [x] 2.1 Write `src/engine/data/frame-data.ts`: load JSON, convert frames→ms once at init (`Math.round(frames * 1000 / 30)`), expose typed accessor `attackStepMs(rig, weaponKind, attackType, step, isFinal, speedBoost)`
- [x] 2.2 Implement rig fallback (missing rig/kind → male) and Special→Heavy tier mapping in the accessor; make it total over rig × kind × tier × step
- [x] 2.3 Implement integer fixed-point lerp `ms(p) = ms0 − round((ms0 − ms40) × p / 40)`
- [x] 2.4 Accessor tests: anchor exactness at p=0/p=40, monotonicity at p=5/10/20, rig fallback, Special=Heavy, totality sweep over all combinations

## 3. Rig and speed-boost derivation

- [x] 3.1 Add `rigForClass(classId)` (FOmar/FOmarl/HUcaseal/RAmarl named rigs; else gender → male/female) with tests over all 12 classes
- [x] 3.2 Expose attack-speed boost on unit definitions in the item loader (stat 19 → boost %; V101 normalized to 40 with a comment citing the client-hardcoded stat)
- [x] 3.3 Derive character `attackSpeedBoost` = max boost among equipped units (no stacking) in equipment stat derivation, including the stat-preview path
- [x] 3.4 Snapshot the boost (and rig) into the run's dispatched character snapshot; decide per design D8 whether the snapshot shape change requires a `SAVE_VERSION` bump + migration, and implement if so

## 4. Pacing replacement

- [x] 4.1 Rewrite `pacing.ts`: delete `WEAPON_COMBO_STEP_MS`, `WEAPON_KIND_ARCHETYPE`, `archetypeForWeaponKind`, `BAREHANDED_COMBO_STEP_MS`; `nextComboDelay` takes rig, weaponKind (null → fist), attack type, step, comboReset, speedBoost; chained steps bill Combo ms, burst-ending steps bill Full ms + repositioning pause
- [x] 4.2 Retune the repositioning pause down from 1000ms (Full frames now carry animation recovery); keep it a single exported const
- [x] 4.3 Update `run.ts` to pass attack type, rig, and boost at the `nextComboDelay` call site; remove `archetypeForWeaponKind` usage from `item-table.ts`
- [x] 4.4 Enumerate remaining `WeaponType` archetype consumers (shop/display/loot); remove the union and `weaponType` wiring if nothing else consumes it, else document what stays
- [x] 4.5 Update pacing tests and regenerate run-determinism/expected-timing fixtures deliberately (assert new exact timings, not just "changed")

## 5. Balance and verification

- [x] 5.1 Add the pattern-balance test: expected sustained DPS of NNN/NHH/HHH vs a reference target across representative hit rates; assert no pattern strictly dominates
- [x] 5.2 Retune shipped default attack patterns if the test finds a dominant pattern
- [x] 5.3 Sanity-check overall run pacing (burst durations per weapon kind vs old archetypes) and adjust the repositioning const if run durations drift materially
- [x] 5.4 Full test suite + replay determinism check (same `(runId, seed)` → identical log across two runs)
