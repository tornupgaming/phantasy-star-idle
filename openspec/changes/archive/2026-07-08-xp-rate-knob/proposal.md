# Global XP rate knob

## Why

Authentic PSO kill XP is tuned for a full action game session; in idle pacing it makes leveling crawl relative to run cadence. A deliberate global XP rate (currently wanted at 2×) needs a formal home — it exists today only as an ad-hoc local edit that contradicts the enemy-stat-data spec.

## What Changes

- Introduce a named engine constant `XP_RATE` (initial value 2) applied to per-kill XP awards, with integer truncation so awards stay whole numbers for any future fractional rate.
- Kill XP becomes `floor(dataset EXP × XP_RATE)`; the battle-log kill event carries the scaled value. All other uses of the stat rows stay authentic and unscaled.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `enemy-stat-data`: the "Difficulty selects authentic stat rows in combat" requirement changes — kill XP is the dataset EXP value scaled by the global XP rate, instead of the raw dataset value.

## Impact

- `src/engine/progression.ts` (`XP_RATE` constant), `src/engine/run.ts` (kill award), `tests/` (kill-XP assertion).
- No persisted-state change (XP is applied at settle from the run result as before); replays of an in-flight run recompute XP with the current rate, matching current behavior for any constant.
