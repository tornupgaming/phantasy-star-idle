## Why

The game currently has exactly one hardcoded character with flat base stats — no
identity, no growth, and no reason to replay content. Adding a roster of
characters with authentic PSO Blue Burst classes, a level/XP system, and section
IDs gives the meta layer its core long-term hooks: build variety (12 classes with
real stat curves) and per-character drop identity (section ID, which a follow-up
change will wire into loot tables).

## What Changes

- **Character roster**: players can create, select, and delete characters instead
  of playing one fixed character. The selected character is the one that equips
  gear, shops, and gets sent on runs.
- **Character creation**: a creation flow picks a name, one of the 12 PSO BB
  classes, and a section ID. Section ID defaults to the PSO-authentic
  derive-from-name algorithm but the player may override it; class and section ID
  are immutable after creation.
- **Classes and leveling**: a new level/XP system. Each class sources its base
  stats, per-level growth deltas, and stat caps from newserv's
  `level-table-v4.json` (see `docs/newserv-reference.md`). Runs award XP.
- **Per-character vs. shared state**: equipment, level/XP, and shop stock are
  per-character (shop stock stays relevant to that character's level).
  Inventory/stash and meseta are shared account-wide.
- **Single run slot**: no concurrent runs — one global run slot, used by the
  selected character. (Multi-character concurrent runs are explicitly out of
  scope.)
- **Section ID is recorded but inert for now**: it does not yet affect loot.
  Porting the section-ID-aware drop tables (`rare-table-v4.json` etc.) is a
  separate follow-up change.
- **BREAKING**: save format changes (`SAVE_VERSION` bump). An existing save's
  lone character migrates to roster slot 1 with a derived section ID and a
  default class.

## Capabilities

### New Capabilities

- `character-roster`: creating, selecting, and deleting characters; the creation
  flow (name, class, section ID with derive-from-name default); immutability
  rules; save migration of the legacy single character.
- `character-progression`: classes as the source of base stats; level/XP model;
  per-level stat growth and level-capped stats per the BB level table; XP awards
  from runs.

### Modified Capabilities

- `character-equipment`: base stats are no longer a fixed starting block — they
  derive from class and level; equipment remains per-character across a roster.
- `loot-economy`: shop stock becomes per-character and scales with that
  character's level; meseta and inventory become explicitly account-wide shared
  state.
- `run-simulation`: a run is bound to the selected character (stats, equipment,
  consumables snapshot) and awards XP on completion; single global run slot is
  enforced across the roster.

## Impact

- **Engine**: `character.ts` (class, level, sectionId fields; stats derived from
  class+level), new module for class/level table data ported from newserv,
  `game.ts` (roster state, selection, creation/deletion, XP award, shop keyed per
  character), `shop.ts` (level-aware stock), `run.ts` (XP in run outcome),
  `content.ts` (starting character → starting roster).
- **Data**: class base stats / level deltas / max stats ported from
  `/home/psmith/projects/newserv/system/tables/level-table-v4.json` into a
  TypeScript data module (checked in; no runtime dependency on the newserv repo).
- **Persistence**: `save.ts` `SAVE_VERSION` bump + migration for existing saves.
- **UI**: `views.ts` — character create/select screens, class/section ID display,
  level/XP display; shop view reflects the active character.
- **Tests**: new character/level/creation tests; existing character, shop, game,
  e2e, and replay tests updated for the roster model. Replay determinism must be
  preserved (level-up math is deterministic; XP feeds from the seeded run).
