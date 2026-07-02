## 1. Class/level data port

- [x] 1.1 Write a throwaway script (scratch, not committed) that parses `/home/psmith/projects/newserv/system/tables/level-table-v4.json` (strip `//` comments), normalizes scaled units (e.g. ATA tenths) into the game's stat units, and emits `src/engine/classes.ts`
- [x] 1.2 Generate and commit `src/engine/classes.ts`: 12 class definitions (id, name, baseStats, pvar, levelDeltas with cumulative XP thresholds, maxStats) plus the canonical class and section ID name lists
- [x] 1.3 Add `tests/classes.test.ts` pinning known reference values (e.g. HUmar level 1 and level 200 stats against published BB tables) and asserting monotonic XP thresholds for all 12 classes

## 2. Character model and progression

- [x] 2.1 Extend `Character` in `src/engine/character.ts` with `id`, `classId`, `sectionId`, `level`, `xp`; remove stored `baseStats`/`pvar` in favor of derivation from class + level (clamped to maxStats)
- [x] 2.2 Implement `sectionIdFromName(name)` (sum of UTF-16 code units mod 10) and section ID display names
- [x] 2.3 Implement XP/leveling: `levelForXp(classId, xp)` up to cap 200, and `applyRunXp` that applies XP and level-ups at run resolution only
- [x] 2.4 Update `tests/character.test.ts` for derived stats, caps, and leveling; add derive-from-name cases

## 3. Roster in game state

- [x] 3.1 Replace `GameState.character` with `roster`, `selectedCharacterId`, and per-character loot filter / attack pattern / survival config; add `selectedCharacter()` accessor on `GameEngine`
- [x] 3.2 Implement create character (name + class + section ID with derived default, roster cap 4), select character (rejected while a run is active), and delete character (unequip into shared inventory; refuse last character and the running character)
- [x] 3.3 Update `content.ts`: starting roster with one default character; keep starter gear auto-equip working
- [x] 3.4 Add roster tests in `tests/game.test.ts` (create/select/delete rules, cap, immutability of class and section ID)

## 4. Runs award XP

- [x] 4.1 Add per-kill XP to `RunResult` events in `src/engine/run.ts` (placeholder XP from enemy tier for now; battle-params port replaces later), bound to the dispatched character id
- [x] 4.2 Apply XP and level-ups when the run resolves in `game.ts`; include XP gained and resulting level in the run report; ensure mid-run stats stay frozen to the dispatch snapshot
- [x] 4.3 Extend `tests/run.test.ts` and `tests/replay.test.ts`: XP totals are seed-deterministic; run resolving for a non-selected character credits the dispatched character

## 5. Per-character shop

- [x] 5.1 Add level-banded gear stock generation to `src/engine/shop.ts`: deterministic from (characterId, level band, restock counter) via the seeded RNG, drawing from existing item content; keep consumables/grinders global
- [x] 5.2 Store per-character shop stock in `GameState`; regenerate on level-band change; purchases deduct shared meseta and add to shared inventory
- [x] 5.3 Update `tests/shop.test.ts`: stock determinism, level-band restock, shared-economy purchase flow

## 6. Save migration

- [x] 6.1 Bump `SAVE_VERSION` and add a migration hook in `src/engine/save.ts` (old envelope → new state instead of returning null)
- [x] 6.2 Implement the v-previous migration: legacy character → roster slot 1 (class HUmar, section ID derived from name, level chosen so derived stats best match without falling below the legacy flat stats, equipment carried over)
- [x] 6.3 Add migration tests: a fixture of the old save shape loads into a valid roster state; unknown/corrupt saves still return null

## 7. UI

- [x] 7.1 Character select screen: roster list with class, section ID, level; switch selection (disabled during a run)
- [x] 7.2 Character creation screen: name input with live derived section ID, class picker (12 classes with base-stat preview), section ID override; delete flow with confirmation
- [x] 7.3 Surface level/XP (and XP gained in the run report) and section ID in the main views; shop view shows the selected character's gear stock
- [x] 7.4 Update `tests/e2e.test.ts` for the roster flow: create a second character, switch, run, verify XP and shared economy

## 8. Verification

- [x] 8.1 Full suite green (`npm test`), typecheck clean (`npm run typecheck`)
- [x] 8.2 Pacing sanity: a fresh level-1 character of each archetype (HUmar, RAmar, FOmarl) can clear the first area on the base difficulty; adjust enemy/content tuning if the ported curves broke it
- [x] 8.3 Manual pass via `npm run dev`: create/switch/delete characters, level up, shop restock, reload mid-run (replay determinism holds)
