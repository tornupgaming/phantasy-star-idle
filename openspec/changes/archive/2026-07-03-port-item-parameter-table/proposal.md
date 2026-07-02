# Port newserv item parameter table

## Why

Item definitions are currently ~15 hand-authored `GEAR` templates in `content.ts` with invented stats. The newserv clone carries the authentic Blue Burst item parameter table (`system/tables/item-parameter-table-bb-v4.json`, 1,536 items) plus a matching name table (`names-v4.json`) — the same data the real BB server serializes to clients. Porting it makes every item's stats, requirements, grind limits, rarity, and sale value authentic and data-driven, following the precedent set by the enemy-stats port (`enemy-stat-data` spec), and unblocks future authentic drop-table and shop work.

## What Changes

- New extraction script `scripts/extract-item-table.mjs` (modeled on `extract-battle-params.mjs`): parses newserv's JSON dialect (comments, hex literals), joins names, prunes render/unknown fields and unused sections, and emits a deterministic standard-JSON dataset.
- New generated dataset `src/engine/data/item-table.json` + typed loader `src/engine/data/item-table.ts` exposing weapons, frames, barriers, and units by item code. All 1,536 entries are extracted — including mags and tools — but the engine consumes only the four gear kinds for now.
- Weapon entries carry their authentic animation category (`WeaponKind`, 19 values — saber, sword, dagger, …, katana, launcher, card — taken directly from the table); a temporary lookup maps each kind onto the existing five attack-speed archetypes in `pacing.ts`. Authentic per-class frame data (wiki.pioneer2.net) is an explicit deferred follow-up keyed by the same categories.
- Equip requirements become part of the item model and are **enforced** in `character.ts`: weapon ATP/ATA/MST requirements, armor/shield required level, and the per-class usability bitmask (maps onto the existing 12-class roster).
- Star values drive rarity; `SaleDivisor` (and the per-kind divisors) drive sell value.
- **Not** in scope: drop tables, shop stock, and run rewards keep referencing the curated `GEAR` templates — no new items enter circulation. No mag system, no tech/tool consumption from the table, no attack-animation frame data.
- Existing curated `GEAR` templates remain the circulating item set, so no save migration is expected (no persisted shape changes; requirement checks apply at equip time and existing templates carry no requirements).

## Capabilities

### New Capabilities

- `item-parameter-data`: authentic BB item dataset — extraction pipeline, generated dataset + typed loader, field semantics (stats, requirements, grind, rarity, usability, sale value), weapon-group speed mapping.

### Modified Capabilities

- `character-equipment`: new requirement — equipping gear is gated by the item's stat/level/class requirements.

## Impact

- **New**: `scripts/extract-item-table.mjs`, `src/engine/data/item-table.json`, `src/engine/data/item-table.ts`, `npm run extract:item-table`.
- **Modified**: `src/engine/items.ts` (definition fields: requirements, weapon group), `src/engine/character.ts` (equip validation), `src/engine/pacing.ts` (group → archetype lookup), `package.json` (script), `docs/newserv-reference.md` (source map entry).
- **Untouched**: `content.ts` drop tables / `GEAR`, `loot.ts`, `shop.ts`, save format (`SAVE_VERSION` unchanged).
- **Dependency**: read-only extraction-time dependency on the local newserv clone (`/home/psmith/projects/newserv`), same as the enemy-stats pipeline.
