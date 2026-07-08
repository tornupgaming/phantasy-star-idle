# Proposal: apply-bb-stat-transform

## Why

Our characters use raw `PlyLevelTbl` values from newserv's `level-table-v4.json`, but the authentic PSO Blue Burst client applies a stat transform on top of that table before stats are displayed or used in combat. Because our enemy stats (from `BattleParamEntry`) are server-side and already authentic, characters are dramatically undertuned: roughly half the correct HP and ~35-40 points short on ATA (e.g., a level 1 HUmar shows HP 20 / ATA 30 instead of the authentic HP 40 / ATA 68). This makes early-game content (Caves at level 7) punishingly hard for the wrong reason.

## What Changes

- Apply the BB client-side stat transform in `statsAtLevel` (and to displayed max caps), on top of the verbatim level table:
  - **ATP**: + role bonus (hunter +10, ranger +5, force +3), including max caps.
  - **HP**: `floor(roleMult × (tableHP + level − 1))` with roleMult hunter 2.0, ranger 1.85, force 1.45; max cap transformed the same way at level 200.
  - **ATA**: the table's base ATA is reinterpreted as **tenths** (not display units), and a per-class constant (in tenths) is added: `ataTenths = classConstant + tableBaseAta + Σ deltas`. Constants verified so far: HUmar 650, RAmar 760, RAcast 710, FOmar 620, FOnewearl 600; the remaining seven derived and verified against Ephinea wiki growth tables. Max ATA cap gets the same constant (e.g., HUmar 1355 + 650 → 200.5 → 200).
  - **TP** (new modeled stat): `MST + level − 1` for hunters/rangers, `floor((MST + level − 1) × 1.5)` for forces, `0` for androids.
  - **DFP / EVP / MST / LCK**: unchanged (table verbatim).
- `classes.ts` stays a verbatim mirror of newserv's JSON (auditable); the transform lives in `progression.ts`. The incorrect header comment claiming `base.ata` is in display units is fixed.
- All 12 classes' derived stats verified at multiple levels (1, 5, 10, 50, 100, 200) against Ephinea wiki tables in a test fixture.
- **BREAKING (determinism)**: stronger derived stats change battle outcomes, so previously recorded `(runId, seed)` replays will not reproduce old results. Saved characters are unaffected (stats are derived from class + level, not persisted).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `character-progression`: "Class-derived base stats" requirement changes — derived stats are no longer the raw table values but the table values with the authentic BB client transform applied (role ATP bonus, HP multiplier with +1 HP/level, per-class ATA constant with tenths-based base ATA, transformed caps), and a TP stat is added to the derived stat set.

## Impact

- `src/engine/progression.ts` — transform implemented in `statsAtLevel` / cap handling; TP derivation.
- `src/engine/classes.ts` — no data changes; add per-class ATA constants and role HP multipliers / ATP bonuses (new authored fields alongside the generated table), fix the ATA-units doc comment.
- `src/engine/stats.ts` — `Stats` gains a `tp` field (derived, not persisted; no `SAVE_VERSION` bump expected — confirm nothing persists derived stats).
- Combat balance shifts everywhere player stats enter `combat.ts` (hit rate via ATA, survivability via HP); pacing/balance checks needed after the change.
- Tests: existing progression tests updated; new fixture asserting all 12 classes match Ephinea-published values at sampled levels.
- UI: stat displays (`stat-preview`, HUD) automatically reflect new values; TP display optional/deferred.
