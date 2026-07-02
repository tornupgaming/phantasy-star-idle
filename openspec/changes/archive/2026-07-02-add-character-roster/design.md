## Context

The engine today has a single hardcoded `Character` (`content.ts:startingCharacter`)
with a flat `baseStats` block and no notion of class, level, or section ID.
`GameState` (`game.ts`) holds `character`, `economy` (meseta + inventory),
`supply`, and a single `activeRun`. The shop (`shop.ts`) sells only consumables
and grinders — there is no gear stock. Saves are versioned via `SAVE_VERSION`
(`save.ts`). All randomness flows through the seeded RNG; replay determinism is
a hard invariant enforced by tests.

Authentic PSO Blue Burst class data is available locally in the newserv clone
(`/home/psmith/projects/newserv/system/tables/level-table-v4.json` — see
`docs/newserv-reference.md`): 12 classes, each with `BaseStats`, 200 `LevelDeltas`
entries (per-level stat gains plus the `EXP` required for that level), and
`MaxStats` caps.

## Goals / Non-Goals

**Goals:**

- Roster of characters: create / select / delete; the selected character plays.
- Creation flow: name + class (12 BB classes) + section ID; section ID defaults
  to the PSO derive-from-name algorithm, overridable at creation, then immutable
  (class too).
- Level/XP system backed by the ported BB level table; runs award XP.
- Per-character state: equipment, level/XP, shop stock (level-relevant).
  Shared state: inventory/stash, meseta, consumable supply.
- Save migration: existing save's character becomes roster slot 1.
- Preserve replay determinism end to end.

**Non-Goals:**

- Section ID affecting drops — recorded now, wired into loot in a follow-up
  change that ports `rare-table-v4.json` / `common-table-v3-v4.json`.
- Concurrent runs. One global run slot remains; extra slots are a possible
  future progression sink.
- Authentic PSO shop tables (`weapon-shop-random-set-*.json`) — deferred to the
  drop-table change; this change uses simple level-banded stock.
- Techniques, mags, class equip restrictions (item-side class requirements stay
  out until the item-table port).

## Decisions

### 1. Class/level data ported into a checked-in TS data module

Port `level-table-v4.json` into `src/engine/classes.ts` (generated once by a
throwaway script, committed as source). Shape per class: `baseStats`,
`levelDeltas[200]` (stat gains + cumulative XP thresholds derived from the
per-level `EXP` field), `maxStats`.

*Why not read the JSON at runtime?* The engine must stay runtime-agnostic and
dependency-free; the newserv repo is a local research clone, not a dependency.
*Note:* the BB table stores some stats in scaled units (e.g. ATA in tenths);
the port normalizes into the game's existing stat units and documents any
scaling applied.

### 2. Character base stats become derived: class + level

`Character` gains `classId`, `sectionId`, `level`, `xp`. `baseStats` is no
longer stored — it is computed as `classBase + sum(deltas[1..level])`, clamped
to `maxStats`. `effectiveStats` keeps its existing shape (base + gear), so
combat code is untouched. `pvar` moves from a per-character constant to a
class-derived value.

*Alternative considered:* storing baseStats and mutating on level-up — rejected
because derived stats make migration trivial, avoid drift bugs, and keep replays
deterministic regardless of when level-ups are applied.

### 3. Section ID: derive-from-name default, player override, immutable

`sectionIdFromName(name)`: sum of the UTF-16 code units of the name, mod 10 —
the classic PSO algorithm. The creation flow shows the derived ID live as the
player types and lets them override. After creation, `classId` and `sectionId`
are immutable (no API to change them). Section ID is stored and displayed but
consulted by nothing else yet.

### 4. Roster in GameState; shared vs. per-character split

```
GameState
├── roster: Character[]           (id, name, classId, sectionId, level, xp, equipment)
├── selectedCharacterId
├── shops: per-character shop stock keyed by character id
├── economy: meseta + inventory   (SHARED)
├── supply: consumables           (SHARED)
└── activeRun                     (single global slot, records characterId)
```

Loot filter, attack pattern, and survival config also become per-character
(they describe how *that* character runs). Deleting a character unequips its
gear into the shared inventory first; deleting the last character is refused.

### 5. XP from runs, level-up at run resolution

`RunResult` gains per-kill XP events (enemy XP values from existing enemy
content, scaled placeholder until battle-params port). XP is applied when the
run resolves; level-ups are pure integer math off the ported thresholds, so the
same seed always yields the same levels. XP is included in the run report.

### 6. Shop: per-character, level-banded stock

The consumable/grinder shop stays global (prices are flat). New: a per-character
gear stock generated deterministically from (characterId, level band, restock
counter) via the seeded RNG, drawing from the existing item content filtered to
the character's level band. Restocks on level-band change. Authentic BB shop
tables replace this generator in the follow-up change.

### 7. Save migration, not reset

`SAVE_VERSION` bump. Migration maps the old save: legacy character → roster
slot 1 with `classId: HUmar` (the archetypal default), `sectionId:
sectionIdFromName(name)`, `level` chosen so derived stats are closest to (but
not below) the legacy flat baseStats; equipment carries over; economy/supply
unchanged. `save.ts` currently rejects mismatched versions — it gains a
migration hook (old envelope → new state) instead of returning null.

## Risks / Trade-offs

- [Ported BB stat curves may not match the game's current combat tuning —
  level-1 characters could be much weaker/stronger than today's fixed stats]
  → migration picks an equivalent level; pacing tests assert the first area is
  still clearable by a fresh level-1 character, tuning enemy content if needed.
- [Scaled units in the BB table (ATA tenths, etc.) silently mis-ported] →
  port script asserts known reference values (e.g. HUmar level 1 / level 200
  stats against published BB tables); unit tests pin a handful of levels.
- [Per-character shop + roster balloons `GameState` churn across UI and tests]
  → keep `GameEngine` method signatures stable where possible; add
  `selectedCharacter()` accessor so call sites don't spread `roster[i]` lookups.
- [Migration guesswork (class/level inference) surprises an existing player] →
  the migrated character is clearly labeled with its assigned class in the UI;
  worst case the player deletes and recreates.
- [Replay determinism broken by XP/level-up mid-run] → levels apply only at run
  resolution, never mid-run; replay tests extended to cover XP totals.

## Migration Plan

1. Land data module + character model changes behind the same change (engine is
   pure; no runtime flagging needed).
2. `SAVE_VERSION` N → N+1 with a one-way migration; old saves load through it.
   Rollback = players keep their old save until first save-write, so a bad
   deploy before first write loses nothing; after that, no downgrade path
   (acceptable: single-player browser game).

## Open Questions

- XP values per enemy: derive placeholder XP from enemy tier now, or port
  `battle-params.json` EXP fields in this change? (Leaning placeholder-now to
  keep the change scoped; the follow-up drop/battle-params port replaces them.)
- Roster size cap (PSO BB had 4 slots per account) — cap at 4 for authenticity
  or leave uncapped? Default: cap at 4, revisit if it feels restrictive.
