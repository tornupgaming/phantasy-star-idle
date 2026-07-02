# Tasks: port authentic enemy stats

## 1. Extraction pipeline

- [x] 1.1 Write `scripts/extract-battle-params.ts` (or `.mjs`): parse the 112-row enemy definition table from newserv `src/EnemyType.cc` (type name, episode flags, stats/resist BP indexes, display name, Ultimate name); assert exactly 112 rows and fail loudly otherwise. Newserv path from CLI arg/env, defaulting to `/home/psmith/projects/newserv`.
- [x] 1.2 Join defs against `battle-params.json` Solo tables per episode × difficulty (ignore the JSON's `Enemies` annotations); take the first stats index for multi-index enemies; assert index bounds; emit sorted-key `src/engine/data/enemy-stats.json` with {hp, atp, dfp, ata, evp, lck, esp, exp, meseta, efr, eic, eth, elt, edk, evpBonus, dfpBonus} per row plus displayName/ultimateName/episodes.
- [x] 1.3 Add an npm script (`extract:enemy-stats`), run it, check in the generated dataset, and add a test asserting Solo-table reference values (Ep1 Booma Normal: HP=60, ATP=80; Ep1 Dragon Normal: HP=1300, EXP=350) and that regeneration is byte-identical.
- [x] 1.4 Document the pipeline in `docs/newserv-reference.md` (source files, the episode-agnostic annotations trap, how to regenerate).

## 2. Engine: dataset-backed enemy stats

- [x] 2.1 Add a typed loader in `src/engine/data/` exposing `getEnemyStats(type, episode, difficulty)` over the generated JSON.
- [x] 2.2 Rework `enemies.ts`: `EnemyDef` references an enemy type plus authored feel fields (pacing `enemyType`, `spread`, `pvarMax`, `dropTableId`); `instantiateEnemy(def, difficulty)` builds the combatant and rewards from the dataset row; remove `EnemyStatScale` and its call sites (`run.ts`, tests).
- [x] 2.3 Route kill XP and meseta through the dataset row; check whether persisted run snapshots embed stat values and bump `SAVE_VERSION` with a migration decision if the shape changes.

## 3. Content: authentic Episode 1 rosters

- [x] 3.1 Replace `ENEMIES` in `content.ts` with authentic Ep1 enemies (Booma/Gobooma/Gigobooma, Rag Rappy, Savage Wolf, Monest, Evil Shark/Pal Shark/Guil Shark, Poison Lily, Gillchic, Canadine/Canane, Dragon), including drop-table assignments and feel fields.
- [x] 3.2 Recompose `AREAS` rooms from the new roster (Forest/Caves/Mines + Dragon boss), keeping room counts similar to today; update `recommendedAtp` per area from the new Normal-difficulty numbers.
- [x] 3.3 Update drop tables/loot references and any UI strings or tests naming removed placeholders.

## 4. Verification and tuning

- [x] 4.1 Update/extend engine tests: difficulty row selection, no stat multipliers applied, roster→dataset resolution for all areas × 4 difficulties, determinism test still green.
- [x] 4.2 Simulate a fresh level-1 character through Forest on Normal (and spot-check Hard) to confirm clearability; adjust area ordering/room composition (not stat values) if pacing breaks.
- [x] 4.3 Run the full test suite and typecheck; regenerate the dataset once more to confirm byte-identical output.
