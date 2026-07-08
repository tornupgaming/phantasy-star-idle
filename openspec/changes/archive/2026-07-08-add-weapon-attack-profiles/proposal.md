# Add Weapon Attack Profiles

## Why

Every weapon in the engine currently resolves an attack identically: one swing, one accuracy/crit/damage roll, one target. In authentic PSO, weapon classes differ mechanically — daggers and mechguns land multiple hits per combo step, and swords, partisans, slicers, and shots strike several enemies per swing. Because our weapon stats are ported from the authentic item table (where multi-hit weapons carry deliberately low per-hit ATP), those weapon classes are currently strictly underpowered: a mechgun lands one of its three bullets. This change makes weapon kind mechanically meaningful and restores the intended balance of the authentic stats.

## What Changes

- Add a per-weapon-kind **attack profile** with two orthogonal axes: hits per combo step (`[step1, step2, step3]`) and maximum targets per swing.
- Multi-hit kinds (single target, N hits per step): dagger 2-2-2, double-saber 2-1-3, mechgun 3-3-3, twin-sword 1-2-2, card 1-1-3. All other kinds default to 1-1-1.
- Multi-target kinds (1 hit per target per step): sword, partisan, slicer, shot. Authentic max-target counts are client-side and not recoverable from newserv; initial values are a balance decision (see design) and tunable.
- Each hit resolves independently through the existing pipeline (own accuracy, crit, and damage rolls, all from the seeded RNG).
- The run loop's character swing fans out to multiple hits/targets; a sweep reaches the engaged enemy plus queued enemies closing in (engagement cap unchanged).
- Battle log emits one `attack` event per hit (existing event schema unchanged), so the stage UI's damage floats and the smoke tests keep working.
- Combo timing is unchanged: hits within a step are simultaneous and the step bills its existing frame-data duration.

## Capabilities

### New Capabilities

- `weapon-attack-profiles`: the per-weapon-kind attack profile data — hits per combo step and max targets per swing — including the default profile and the authored table.

### Modified Capabilities

- `combat-resolution`: per-attack hit resolution becomes per-*hit* resolution — a combo step comprises one or more hits, each with an independent accuracy/crit/damage roll; combo-step accuracy modifiers apply to every hit in that step.
- `run-simulation`: character swing resolution fans out per the equipped weapon's attack profile (multiple hits, multiple targets); target selection for sweeps; per-hit attack log events; combo-reset semantics when a sweep kills its primary target.

## Impact

- `src/engine/items.ts` (or a new `src/engine/data/attack-profiles.ts`): profile table keyed by `WeaponKindName`.
- `src/engine/combat.ts`: unchanged pipeline, but consumed per hit; may gain a small helper to resolve a full step.
- `src/engine/run.ts`: character attack block (targeting, hit fan-out, per-hit logging, kill/XP/drop handling per hit, combo-reset rule).
- `tests/`: new unit tests for profile fan-out and determinism; existing combat/run tests unaffected in shape but RNG draw counts change, so any golden-log fixtures for runs using affected weapon kinds will shift (deterministic within this version — replay determinism per `(runId, seed)` is preserved).
- No save-shape change (`SAVE_VERSION` untouched); no pacing/frame-data change; UI unchanged (event schema preserved).
- Balance: multi-hit weapons gain their intended output; recommend a `balance-sim` sweep after implementation to validate clear rates and tune max-target counts.
