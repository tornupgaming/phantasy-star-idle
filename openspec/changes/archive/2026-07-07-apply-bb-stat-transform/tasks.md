# Tasks: apply-bb-stat-transform

## 1. Derive and fixture the reference data

- [x] 1.1 Scrape/transcribe Ephinea wiki detailed growth tables for all 12 classes at levels 1, 5, 10, 50, 100, 150, 200 (HP, TP, ATP, DFP, MST, ATA, EVP) into a checked-in JSON test fixture with a source-URL comment
- [x] 1.2 Derive the seven unverified per-class ATA constants (HUnewearl, HUcast, HUcaseal, RAmarl, RAcaseal, FOmarl, FOnewm) as `wikiL1AtaTenths − tableBaseAta`, and confirm the five known ones (HUmar 650, RAmar 760, RAcast 710, FOmar 620, FOnewearl 600); sanity-check each constant is stable across levels 1/10/200
- [x] 1.3 Cross-check one class per role against a second source (schtserv or pso-world charts) to guard against Ephinea-specific deviations

## 2. Engine implementation

- [x] 2.1 Add authored constants to `classes.ts` (separate from the generated block): `ROLE_ATP_BONUS`, `ROLE_HP_MULT_HUNDREDTHS` per role, per-class `ataConstantTenths`; fix the header comment claiming `base.ata` is in display units
- [x] 2.2 Add `tp` to `Stats`/`makeStats` in `stats.ts`; confirm nothing persists derived stats (no `SAVE_VERSION` bump) and note the finding in the commit message
- [x] 2.3 Implement the transform in `statsAtLevel` (`progression.ts`): raw accumulation + raw-cap clamp, then ATP role bonus, HP `floor(multHundredths × (rawHP + level − 1) / 100)`, ATA `constant + rawTenths` with transformed cap, TP formula with android special case via `CLASS_EQUIP_MASK`
- [x] 2.4 Expose transformed effective caps wherever caps are read (stat preview / any UI cap display), keeping raw caps internal

## 3. Tests

- [x] 3.1 Fixture test: `statsAtLevel` matches the Ephinea fixture for all 12 classes at all sampled levels (ATA compared at 0.1 precision, everything else exact)
- [x] 3.2 Unit tests for TP edge cases (android 0, force ×1.5 floor, L1 FOnewearl = 87) and cap behavior at level 200 (HUmar ATA 200, ATP 1397)
- [x] 3.3 Update existing progression/character tests that assert old raw values; run full `vitest run`
- [x] 3.4 Determinism check: same (classId, level) → identical stats; existing replay-determinism tests still pass under new stats

## 4. Verification and follow-up

- [x] 4.1 Playcheck: create a HUmar, verify HUD/stat preview shows HP 40 / ATA 68 at level 1, and stats at a few levels match the wiki
- [x] 4.2 Run a `balance-sim` sweep (clear rates and survival by area for levels 1–15) comparing before/after; record results in the change and file a follow-up balance change if pacing is now off
- [x] 4.3 Note in the change/commit that old (runId, seed) replays diverge by design
