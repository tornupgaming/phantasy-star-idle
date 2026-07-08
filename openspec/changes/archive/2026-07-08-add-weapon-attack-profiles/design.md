# Design — add-weapon-attack-profiles

## Context

Combat today is strictly one swing → one `resolveAttack` → one target (`src/engine/run.ts:509-557`), with the target always `enemies.findIndex(!isDead)`. Weapon kinds (0..18, `WEAPON_KIND_NAMES` in `src/engine/items.ts`) already drive per-kind combo timing via the frame data, but have no effect on attack resolution. `ENGAGED_ENEMIES = 1` (`run.ts:72`): one enemy attacks at a time; the rest queue and step in on a kill.

newserv holds no hit-count or target-count data (combat damage is client-side; verified — the server only relays per-step strike commands, repeated once per multi-hit swing). The authentic *structure* is per-combo-step hit counts per weapon kind; the *numbers* for max targets are ours to choose.

Constraints: engine purity, all randomness through the seeded RNG, replay determinism per `(runId, seed)`, authentic PSO math untouched, no save-shape change.

## Goals / Non-Goals

**Goals:**
- Weapon kind changes how a swing resolves: hits per combo step, targets per swing.
- Each hit is an independent, seeded, authentic-pipeline resolution.
- Battle log and stage UI keep working without schema changes.

**Non-Goals:**
- No change to engagement/aggro (`ENGAGED_ENEMIES` stays 1).
- No change to pacing/frame data (hits within a step are simultaneous).
- No new weapon items or stat changes; no save version bump.
- No special-attack behavior (still reserved).
- Final balance numbers for max targets (initial values shipped, tuned later via `balance-sim`).

## Decisions

**D1 — Profile table keyed by `WeaponKindName`, in `src/engine/data/attack-profiles.ts`.**
`{ hitsPerStep: [n1, n2, n3]; maxTargets: number }`, with a `DEFAULT_ATTACK_PROFILE` of `{ hitsPerStep: [1,1,1], maxTargets: 1 }` for unlisted kinds. Keyed by kind name (not coarse `WeaponType`) because the mechanics are per authentic kind, and every weapon already resolves to a kind via `weaponKindForItem`. Kept in `data/` beside `frame-data` since it's authored per-kind data, not logic. The two axes are orthogonal so a future kind can be both multi-hit and multi-target.

Authored values:

| kind | hits/step | max targets |
|---|---|---|
| dagger | 2-2-2 | 1 |
| double-saber | 2-1-3 | 1 |
| mechgun | 3-3-3 | 1 |
| twin-sword | 1-2-2 | 1 |
| card | 1-1-3 | 1 |
| sword | 1-1-1 | 4 |
| partisan | 1-1-1 | 3 |
| slicer | 1-1-1 | 4 |
| shot | 1-1-1 | 5 |

Max-target values are balance constants (authentic values are client-side spatial hitboxes, not fixed numbers); chosen so shot > sword/slicer > partisan, pending a `balance-sim` sweep. Alternative considered: putting profiles on each weapon item — rejected; behavior is per kind, and per-item data would bloat the item table for no current need.

**D2 — Independent resolution per hit, fixed RNG draw order.**
Each hit runs the full existing `resolveAttack` pipeline: own accuracy roll (the step's combo-accuracy modifier applies to every hit in that step), own crit roll, own Wvar/Pvar damage draws. Draw order is defined as: targets in roster order, then hits 1..N against each target. Matches PSO (mechgun bullets miss independently) and keeps determinism trivially. Alternative — one accuracy roll shared per swing — rejected: less authentic and makes multi-hit all-or-nothing.

**D3 — Sweep targeting: first `maxTargets` living enemies in roster order; engagement unchanged.**
A multi-target swing hits the engaged enemy plus queued enemies "closing in" — they're present in the room and this is the cheapest reading that makes AoE meaningful under `ENGAGED_ENEMIES = 1`. Being hit does not engage a queued enemy (no aggro change); `engageNext()` still fires per kill as today. Alternatives: raising the engagement cap (rejected — changes incoming-damage balance and the survival economy, a separate feature) and reach-based engagement (rejected — same, plus new spatial modeling).

**D4 — One `attack` log event per hit; schema unchanged.**
Each hit emits the existing event payload (`actor`, `targetIndex`, `hit`, `crit`, `damage`, `hpAfter`), so `stage.ts` damage floats, the log renderer, and the smoke tests need no changes, and per-target HP remains reconstructable hit by hit. Kill/XP/drop handling runs per hit as soon as a target's HP reaches 0; later hits in the same swing skip dead targets (no overkill fan-out onto a corpse) and do not retarget mid-swing. Alternative — one event with a `hits[]` array — rejected: touches the event union, stage, and tests for a cosmetic gain.

**D5 — Combo resets only when the primary target dies.**
The primary target is the first target of the swing (the currently engaged enemy). If it dies, the existing kill-reset/repositioning semantics apply (`charAttackIndex = 0`, Full-duration billing). A sweep killing only secondary targets does not reset the combo — the character never repositioned. Miss handling is per hit; the combo advances once per swing exactly as today.

**D6 — Timing untouched.**
A swing bills one frame-data step duration regardless of hit or target count; `nextComboDelay` is called once per swing, as now.

## Risks / Trade-offs

- [Mechguns triple log/float volume] → Acceptable initially; floats already stack per event. Revisit with an aggregated float if the stage gets noisy.
- [Multi-hit kinds get a large effective-DPS jump] → Intended (authentic stats assume it), but clear rates shift; run a `balance-sim` sweep across weapon kinds/difficulties after implementation and tune `maxTargets` values there.
- [RNG draw count per swing changes] → Deterministic within this version, but any recorded golden-log fixtures (`tests/fixtures/`) covering runs with affected weapon kinds must be regenerated; cross-version replay is not a supported guarantee.
- [Sweeps damage enemies that aren't attacking yet] → A knowing abstraction (D3); the queued enemy is "closing in." If it reads oddly in the log, wording can note the sweep.

## Open Questions

- Exact `maxTargets` tuning (D1 table is the starting point; settle via `balance-sim` after implementation).
- Whether claw/katana/launcher should eventually get profiles (default 1-1-1×1 for now; the table makes adding them trivial).
