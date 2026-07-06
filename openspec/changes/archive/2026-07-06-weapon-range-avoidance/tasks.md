# Tasks: weapon-range-avoidance

## 1. Avoidance data module

- [x] 1.1 Create `src/engine/data/avoidance.ts` with `AVOIDANCE_PCT: Record<WeaponKindName, number>` using the authored tier values from design D1, and a `weaponAvoidancePct(weaponKind: number | null): number` lookup that resolves numeric kinds via `WEAPON_KIND_NAMES` and maps `null` (barehanded) to `fist`
- [x] 1.2 Unit tests: every one of the 19 kinds resolves to a value in (0, 100); range ordering holds (rifle > handgun ≥ launcher > slicer > mechgun ≥ shot > partisan > saber; cane/rod/wand equal saber); barehanded returns the fist value; unknown numeric kind throws or falls back consistently with `frame-data.ts` conventions

## 2. Sidestep pre-roll in the run loop

- [x] 2.1 Add `"sidestep"` to `RunEventKind` and a `SidestepEventData` payload (`{ actor: number }`) in `src/engine/run.ts`, following the existing structured-event pattern
- [x] 2.2 In the enemy-attack branch, draw once from the run RNG against the dispatched weapon's avoidance before `resolveAttack`; on success emit the sidestep event (text like `"<enemy> lunges — you sidestep."`) and skip resolution entirely; on failure run the existing pipeline unchanged; the enemy's next-attack clock advances identically in both cases
- [x] 2.3 Unit tests for the pre-roll: sidestep leaves HP and heal/revive state untouched and consumes exactly one RNG draw; failed sidestep resolves identically in form to pre-change behavior; character attacks perform no sidestep roll; same (runId, seed) reproduces the same sidestep pattern
- [x] 2.4 Re-pin existing test fixtures whose battle-log/replay expectations shift due to the added RNG draw per enemy attack (run `vitest run` and triage; no save-shape change, so no `SAVE_VERSION` bump)

## 3. Battle scene and log presentation

- [x] 3.1 Fold `sidestep` events in the scene reducer/renderer (`src/ui/stage.ts`): show an evade indicator on the character, visually distinct from the red MISS glyph, no health-bar change; reuse the atlas/plain-text fallback path
- [x] 3.2 Battle log and ticker render sidestep lines with the existing muted (miss-style) styling
- [x] 3.3 Extend UI smoke tests to cover a revealed sidestep event (indicator appears, HP bar unchanged)

## 4. Weapon card and equipment display

- [x] 4.1 Add an always-present AVD chip to the weapon chip row on Nova shop cards, consistent with the existing chip language (color/label per design D4)
- [x] 4.2 Show the avoidance percentage in the equipment views: equipped-weapon stats, swap/preview flow, and the barehanded (fist) value when no weapon is equipped
- [x] 4.3 Extend UI smoke tests: AVD chip renders on every listed weapon; equipment view shows avoidance for equipped and barehanded states

## 5. Balance tuning

- [x] 5.1 Run seeded simulation sweeps (balance-sim) over the avoidance scale: target near-zero death rate and modest consumable burn for a level-appropriate character in early areas; verify melee clears meaningfully faster while ranged burns meaningfully fewer consumables (no strict dominance either way); adjust absolute tier values (keep D1 ordering/spacing) and record the sweep summary in the change
- [x] 5.2 Revisit `DEFAULT_SURVIVAL.healThresholdFraction` (currently 0.65) under the tuned avoidance values and lower it if sweeps show the aggressive threshold is no longer needed
- [x] 5.3 Playcheck: full run in headless Chromium wielding a melee weapon and a ranged weapon; confirm sidestep beats read clearly in the scene/log and the AVD chip/stat displays match the engine table
