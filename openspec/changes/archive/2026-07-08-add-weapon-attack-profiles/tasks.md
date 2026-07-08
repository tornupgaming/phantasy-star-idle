# Tasks — add-weapon-attack-profiles

## 1. Attack profile data

- [x] 1.1 Create `src/engine/data/attack-profiles.ts`: `AttackProfile` type (`hitsPerStep: [number, number, number]`, `maxTargets: number`), `DEFAULT_ATTACK_PROFILE` (1-1-1 × 1), and the authored table keyed by `WeaponKindName` (dagger 2-2-2, double-saber 2-1-3, mechgun 3-3-3, twin-sword 1-2-2, card 1-1-3; sword ×4, partisan ×3, slicer ×4, shot ×5 targets)
- [x] 1.2 Add a resolver `attackProfileForWeaponKind(weaponKind: number | null): AttackProfile` (fist/barehanded and unlisted kinds → default), wired to the same kind resolution used by pacing (`weaponKindForItem`)
- [x] 1.3 Unit tests: authored values match spec, unlisted kinds and barehanded get the default profile

## 2. Run-loop fan-out

- [x] 2.1 Refactor the character attack block in `src/engine/run.ts` to loop targets (first `maxTargets` living enemies in roster order) then hits per step, calling `resolveAttack` per hit in that fixed order
- [x] 2.2 Emit one `attack` log event per hit with the existing payload shape; run kill handling (XP, drop, `engageNext()`) immediately when a hit kills, skip further hits on the dead target, and do not retarget mid-swing
- [x] 2.3 Combo-reset rule: reset (`charAttackIndex = 0`) only when the primary target (first target of the swing) died; advance the combo once per swing; bill `nextComboDelay` once per swing with `comboReset` reflecting primary death only
- [x] 2.4 Verify sweeps do not alter engagement: struck queued enemies keep their clocks stopped until `engageNext()` engages them

## 3. Tests

- [x] 3.1 Engine tests for multi-hit: dagger/mechgun steps produce the expected event count per swing, mixed hit/miss/crit within a step, step-2/3 accuracy modifier applied to every hit in the step
- [x] 3.2 Engine tests for multi-target: sword/shot swings hit living enemies in roster order up to `maxTargets`; mid-swing kill emits kill event immediately with no overkill hits; secondary kill does not reset the combo, primary kill does
- [x] 3.3 Determinism test: same `(runId, seed)` with a multi-hit and a multi-target weapon reproduces identical logs across re-simulations
- [x] 3.4 Timing test: swing duration billed once per step regardless of hits/targets (mechgun vs saber comparison per the spec scenario)
- [x] 3.5 Regenerate any golden-log fixtures under `tests/fixtures/` affected by the changed RNG draw counts; run the full suite

## 4. Verification & balance

- [x] 4.1 Playcheck: run with a mechgun and a sword equipped; confirm per-hit damage floats and log lines render sanely (multi-hit volume acceptable) and per-enemy HP tracks correctly in the stage
- [x] 4.2 `balance-sim` sweep across weapon kinds and difficulties: clear rates and time-to-clear before/after; tune `maxTargets` constants if any multi-target kind dominates or lags badly
