# Design: port authentic enemy stats

## Context

Enemy stats in `src/engine/content.ts` are placeholders scaled at run time by `EnemyStatScale` multipliers (`src/engine/enemies.ts`). The canonical source is newserv's `system/tables/battle-params.json`:

- 6 tables (`Episode{1,2,4}-{Online,Solo}`) × 4 difficulties × 96 fixed BP slots.
- Each slot: `Stats` (HP/ATP/DFP/ATA/EVP/LCK/ESP/EXP/Meseta), `AttackData`, `ResistData`, `MovementData`.
- **Trap**: the `Enemies: [...]` annotations on each slot are episode-agnostic (the Ep1 table annotates 64 enemies that never appear in Ep1). They must not be used for extraction.
- The authoritative mapping is the 112-row static table in newserv `src/EnemyType.cc`: per enemy type — episode, separate BP indexes for stats/attack/resist/movement, internal name, display name, and Ultimate display name.

Exploration verified: the EnemyType.cc table parses cleanly with a regex (112/112 rows), and joined stats match known BB values (Online table: Booma 92 HP Normal → 2334 Ultimate; the chosen Solo table gives Booma 60 HP Normal → 1556 Ultimate, Dragon 1300 → 9500 HP).

## Goals / Non-Goals

**Goals:**
- A reproducible extraction pipeline producing a small, readable, checked-in dataset.
- Runs fight enemies with authentic BB **Solo-mode** stats selected by difficulty.
- Area rosters contain only authentic Episode 1 enemies.

**Non-Goals:**
- Episode 2/4 content (dataset includes their stats for the future; no areas use them yet).
- Using `AttackData`/`MovementData` (positional/multi-attack detail irrelevant to idle combat; `Stats.ATP` drives enemy damage as today).
- Elemental/tech resistances in combat (resist data is carried in the dataset for a future techniques feature, not wired into combat now).
- Rebalancing character-side formulas (already anchored to authentic BB curves in `classes.ts`).

## Decisions

1. **Solo tables, not Online.** One dispatched character ≈ BB one-player mode; Sega balanced Solo for exactly that. (Decided with user.)
2. **Extraction script parses `EnemyType.cc` + `battle-params.json`; annotations ignored.** Script lives in `scripts/` (standalone Node/TS, run manually via an npm script), reads the newserv clone path from an env var/CLI arg defaulting to `/home/psmith/projects/newserv`. It fails loudly if the EnemyType.cc regex yields ≠112 rows or a referenced BP index is missing — guarding against upstream newserv changes.
3. **Output: generated `src/engine/data/enemy-stats.json`, checked in.** Shape: `{ [enemyTypeName]: { displayName, ultimateName?, episodes, perEpisode: { [ep]: { [difficulty]: { hp, atp, dfp, ata, evp, lck, esp, exp, meseta, efr, eic, eth, elt, edk, evpBonus, dfpBonus } } } } }`. Multi-index `stats` lists use the first index (multi-part bosses keep one canonical row). JSON (not TS) keeps the artifact diffable and obviously generated; a small typed loader in the engine wraps it.
4. **Difficulty selects a row; `EnemyStatScale` retired.** `EnemyDef` becomes a reference (enemy type + presentation/feel fields); `instantiateEnemy(def, difficulty)` reads the stat row from the dataset. Non-authentic multipliers are deleted rather than kept as a parallel path.
5. **Hand-authored "feel" fields stay in content.** `spread`, `pvarMax`, `enemyType` (pacing class), and `dropTableId` are not in battle-params; they remain authored per enemy in `content.ts` alongside the dataset reference.
6. **Roster redesign.** Replace Rag Crab/Savage Bat with authentic Ep1 enemies; fix Gilchic→Gillchic. Areas re-composed from: Booma/Gobooma/Gigobooma, Rag Rappy, Savage Wolf, Monest (+Mothmant spawns simplified to Monest only), Evil Shark/Pal Shark/Guil Shark, Poison Lily, Gillchic, Canadine/Canane, Dragon (boss). Exact room compositions decided during implementation to keep room counts similar to today.

## Risks / Trade-offs

- [Upstream newserv format drift breaks extraction] → strict row-count and index-bounds assertions; dataset is checked in, so the game never depends on newserv at build/runtime.
- [Solo Normal stats exceed current placeholders (e.g. Booma 60 vs 42 HP, ATP 80 vs 33) and may upset early-game pacing] → tune area order/recommendedAtp and starter gear expectations as part of the roster task; verify a fresh level-1 character can clear Forest Normal in simulation.
  - *Implementation outcome*: composition alone wasn't enough (an idle character tanks every attacker; authentic hits are ~half of level-1 HP). Verified fixes, all non-stat knobs: forest rooms cap simultaneous hard hitters (Monest fought last), `DEFAULT_SURVIVAL.healThresholdFraction` 0.4 → 0.65 (closes the single-hit-lethal window), starting supply 10 monomates + 2 moon atomizers (absorbs crit spikes). Simulated clear rates: HUmar 20/20, RAmar (with class-appropriate Scout Rifle) 20/20. **Forces are exempt from the level-1 pacing gate** (user decision): without techniques a level-1 FOmarl cannot beat authentic enemy EVP in melee — revisit when techniques land (FOmarl clears 18/20 at level 5).
- [Run snapshots may embed enemy stats → save-shape question] → inspect persisted state during implementation; if run state stores stat values (not just def ids), bump `SAVE_VERSION` and drop/migrate in-flight runs.
- [Determinism: same (runId, seed) now yields different outcomes than pre-change] → acceptable across a content change; replay determinism is only guaranteed within a data version.

## Open Questions

- None blocking; room compositions and pacing numbers are implementation-time tuning within the constraints above.
