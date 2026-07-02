# Port authentic enemy stats (battle-params) and redesign area rosters

## Why

Enemy stats are currently hand-tuned placeholders, and two enemies ("Rag Crab", "Savage Bat") don't exist in PSO at all. The canonical Blue Burst stats live in newserv's `battle-params.json` (115k lines, 3 MB) — too large and too irregular to use directly, and its per-entry `Enemies` annotations are episode-agnostic and therefore untrustworthy. We need a condensed, verified dataset so runs fight enemies with authentic stats per difficulty.

## What Changes

- Add an extraction script (`scripts/`) that joins newserv's `battle-params.json` (Solo tables) with the authoritative enemy→(episode, BP index) mapping parsed from newserv's `src/EnemyType.cc`, emitting a condensed generated dataset at `src/engine/data/enemy-stats.json` (~112 enemies × episode × 4 difficulties: HP, ATP, DFP, ATA, EVP, LCK, ESP, EXP, meseta, plus resist data and Ultimate display names).
- Engine: enemy stats are looked up per difficulty from the dataset — difficulty selects a stat row instead of applying `EnemyStatScale` multipliers. **BREAKING** for internal API: `EnemyStatScale` is removed/retired for dataset-backed enemies.
- Content: replace placeholder enemies with the authentic Episode 1 roster (Booma family, Rag Rappy, Savage Wolf, Monest/Mothmant, Evil Shark family, Poison Lily, Gillchic, Canadine family, Dragon) and update `AREAS` room compositions in `content.ts` accordingly. Fixes the "Gilchic"→"Gillchic" name.

## Capabilities

### New Capabilities
- `enemy-stat-data`: Authentic per-enemy, per-difficulty stat data sourced from PSO Blue Burst (Solo mode) via a reproducible extraction pipeline; enemies fought in runs use these stats, and area rosters reference only authentic enemies.

### Modified Capabilities

None — no existing spec states requirements about enemy stat values or difficulty scaling (the multiplier approach was implementation detail). `run-simulation`, `combat-resolution`, and `loot-economy` requirements are unaffected at the spec level.

## Impact

- **New**: `scripts/extract-battle-params.*`, `src/engine/data/enemy-stats.json` (generated, checked in).
- **Modified**: `src/engine/enemies.ts` (stat lookup replaces `EnemyStatScale`), `src/engine/content.ts` (`ENEMIES`, `AREAS`, drop table references), `src/engine/run.ts` / callers of `instantiateEnemy` as needed, `docs/newserv-reference.md` (document the extraction).
- **Dependencies**: read-only dependency on the local newserv clone at extraction time only; the game bundle depends only on the generated JSON.
- **Saves/replays**: enemy stats change combat outcomes; in-flight run replays are not preserved across this change (acceptable — verify whether persisted state shape changes; if run snapshots embed enemy stats, a `SAVE_VERSION` decision is required).
- **Balance**: authentic Solo-table numbers are substantially higher than current placeholders (e.g. Booma 92 HP vs 42); pacing/progression tuning expectations shift, anchored to authentic BB character curves already in `classes.ts`.
