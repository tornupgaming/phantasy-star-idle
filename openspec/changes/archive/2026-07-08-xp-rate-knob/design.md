# Design — Global XP rate knob

## Context

Kill XP currently reads straight from the authentic per-difficulty stat row (`target.stats.exp`), per the enemy-stat-data spec. An uncommitted local tweak doubles it inline in `run.ts`. Idle pacing wants that 2× as a real, documented knob.

## Goals / Non-Goals

**Goals:** a single named constant governing kill-XP scaling, spec-consistent, deterministic, integer awards.

**Non-Goals:** per-difficulty or per-area XP rates, UI exposure, meseta/drop scaling (meseta already has `mesetaMult` per difficulty), rebalancing the class XP curves.

## Decisions

- **`XP_RATE` lives in `progression.ts`** next to the XP/leveling helpers it feeds, exported for tests; `run.ts` imports it. It is an economy-pacing knob like `DIFFICULTIES[*].mesetaMult`, not part of the authentic dataset — the stat rows stay untouched.
- **Applied at the kill site with `Math.floor`**: `floor(stats.exp * XP_RATE)`. Truncation keeps awards integral for any future fractional rate and matches PSO's integer-math conventions. The scaled value flows into `xpGained`, the kill log event, and the run report unchanged in shape.
- **Replay safety:** the rate is a compile-time constant, so re-simulating a stored run reproduces identical logs. Changing the constant between sessions would change an in-flight run's recomputed XP — same class of effect as any balance-constant edit, accepted (XP lands only at settle).

## Risks / Trade-offs

- [Spec drift] The enemy-stat-data spec's "no multiplier" language must change in the same commit — handled by the delta spec here.
