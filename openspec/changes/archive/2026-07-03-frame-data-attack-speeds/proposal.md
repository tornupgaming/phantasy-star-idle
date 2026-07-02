# Frame-data attack speeds

## Why

Character attack pacing currently uses five hand-authored speed archetypes (`WEAPON_COMBO_STEP_MS`), a placeholder that `pacing.ts` explicitly marks as a temporary seam to be deleted once authentic frame data lands. The pioneer2.net community has measured PSO:BB's real per-animation frame data (30 fps), giving us per-rig, per-weapon-kind, per-attack-tier combo timings — including the fact that Heavy attacks are genuinely slower than Normal, a tradeoff the current model misses entirely (Heavy is strictly better DPS today). Attack-speed units (General/Battle → Heavenly/Battle, V101) are iconic PSO chase items and already exist in the condensed item dataset (stat 19) but have no gameplay effect.

## What Changes

- Add a frame-data dataset extracted from the pioneer2.net wiki page (wikitext already archived): per animation rig × weapon kind × attack tier (Normal/Heavy) × combo step, in two measured anchors — 0% speed and +40% speed (V101-class). Missing 0% cells (13 of 19 weapon kinds were never measured at 0%) are reconstructed from per-position median 0%/40% ratios and flagged as such.
- Frame counts are converted once into integer game-millisecond consts (`round(frames × 1000/30)`); the runtime pacing layer only ever sees ms.
- Replace the archetype pacing table: `WEAPON_KIND_ARCHETYPE` / `WEAPON_COMBO_STEP_MS` are deleted; `nextComboDelay` becomes rig-, weapon-kind-, attack-type-, and speed-aware. Combo-chained steps use "combo" frames; the burst-ending step uses "full" frames (which include the animation's recovery tail). **BREAKING** for the pacing module API; run replay timing changes for all weapons.
- Class → animation rig resolution: male/female by gender, with HUcaseal, RAmarl, FOmar, FOmarl rig overrides; rigs without a measured entry for a weapon kind fall back to the male table (the wiki's own convention).
- Attack-speed units become functional: equipped units with stat 19 grant their percentage boost (General 5, Devil 10, God 20, Heavenly 40); V101 (client-hardcoded stat in the source data) is treated as +40%. Only the **highest** equipped boost applies (no stacking). Effective timing at boost `p` is a fixed-point lerp between the 0% and 40% ms anchors, exact at both measured endpoints.
- Special attacks use Heavy timing (the wiki's rule; exotic weapons with unique animations are out of scope).
- Heavy attacks costing real frames shifts N/H pattern DPS; the default attack patterns get a balance check in the same pass.
- The kill/repositioning recovery pause is retained as a separate hand-tuned pacing knob (it models movement, not animation).
- Enemy attack intervals are unchanged (frame data does not cover enemies).

## Capabilities

### New Capabilities

- `attack-frame-data`: the authentic frame-data dataset — wikitext extraction pipeline, two-anchor (0%/40%) frame tables per rig × weapon kind × tier × combo step, reconstruction rule for unmeasured 0% cells, frames→ms const conversion, and the typed accessor with rig fallback.

### Modified Capabilities

- `item-parameter-data`: the "Weapon kind speed mapping" requirement (archetype lookup table) is replaced — weapon kinds now resolve to frame-data timings, and the condensed dataset's unit entries expose the attack-speed stat (stat 19) to the engine.
- `combat-resolution`: the "Two-clock combat exchange" character cadence changes from flat per-weapon-type step + fixed recovery to per-rig/kind/tier frame timings with combo-vs-full step semantics; Heavy/Special attacks take longer than Normal.
- `character-equipment`: equipped attack-speed units affect derived attack cadence; highest equipped boost applies, no stacking.

## Impact

- `src/engine/pacing.ts` — archetype tables deleted; new frame-data-backed API (signature change).
- `src/engine/run.ts` — `nextComboDelay` call site passes attack type, rig, and speed boost.
- `src/engine/data/` — new `frame-data.json` + typed module; `item-table.ts` loses `archetypeForWeaponKind` usage.
- `scripts/` — new `extract-frame-data.mjs` parsing the archived wikitext (same pattern as `extract-item-table.mjs`).
- `src/engine/character.ts` / equipment stat derivation — surface the equipped speed boost.
- Tests: pacing, run determinism (expected-timing fixtures change), new frame-data extraction/accessor tests, attack-pattern balance check.
- No save-shape change expected (units are already persistable items); confirm during design.
