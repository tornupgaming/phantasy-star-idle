# Ep1-complete area selection

## Why

The game ships with three curated areas (Forest 1, Cave 1, Mine 1 + glued Dragon) while the authentic spawn data (`map-spawns.json`) and enemy stat dataset already cover every Episode 1 floor. Players run out of destinations long before they run out of progression curve; exposing all 14 Ep1 floors (10 regular + 4 boss arenas) fills out the mid/late game with zero new data extraction.

## What Changes

- Replace the three themed areas (`forest`/`caves`/`mines`) with one selectable area per Ep1 floor: Forest 1–2, Cave 1–3, Mine 1–2, Ruins 1–3, plus Dragon, De Rol Le, Vol Opt, and Dark Falz as standalone boss arenas. **BREAKING**: area ids change; saves storing an active run's area id need a version bump and migration.
- Areas are grouped by zone (Forest, Caves, Mines, Ruins, Bosses) with an episode dimension (Ep1 only for now; Ep2/Ep4 greyed out pending data).
- Fill in the ~25 missing Ep1 enemy roster entries (Ruins roster, Hildebear, Dubchic, Dark Gunner line, slimes, etc.) with hand-authored feel fields; stats come from the existing dataset.
- Boss arenas fight a single boss enemy (Dragon-style); multi-part boss simulation (De Rol Le segments, Vol Opt phases) is explicitly out of scope.
- Stat-less gadget spawn types (`DUBWITCH`, `BEE_L`/`BEE_R`, `DARK_GUNNER_CONTROL`, `DARVANT`, boss body parts) are skipped by stage generation via an explicit allowlist.
- Extend rare-variant rolls with the remaining Ep1 pairs (Hildebear → Hildeblue, Pofuilly Slime → Pouilly Slime).
- Extend `AREA_NORM_BY_FLOOR` to boss floors 12–14 per the existing boss-floor drop rule (De Rol Le → Mine 1, Vol Opt → Ruins 1, Dark Falz → Ruins 3).
- Rework the Hunters Guild pane: episode + difficulty + attack pattern + counter settings in the central panel; the destination (area) list moves to the right detail panel as a zone-grouped menu. Keyboard navigation follows.

## Capabilities

### New Capabilities

- `area-catalog`: the engine-side catalog of selectable run areas — one per authentic Ep1 floor, grouped by zone and episode, each wired to its floor's authentic spawn layouts; boss arenas as single-boss areas; per-area recommended ATP; stage-generation coverage rules for the full Ep1 spawn-type set (gadget skip list, rare-variant pairs).

### Modified Capabilities

- `ui-navigation`: the Pioneer 2 hub requirement's Hunters Guild description changes — the area menu leaves the central quest-counter window and becomes a zone-grouped destination list in the pane's detail (right) panel; the central panel gains an episode selector row; loot filter and supply stay in a subordinate settings window that no longer occupies the detail panel.

## Impact

- `src/engine/content.ts` — ~25 new `ENEMIES` entries; `AREAS`/`AREA_LIST` rebuilt per floor with zone grouping.
- `src/engine/areas.ts` — `AreaDef` gains grouping fields; `AREA_NORM_BY_FLOOR` extended to floors 12–14; `bossFloor` gluing removed (bosses stand alone).
- `src/engine/stage-gen.ts` — gadget skip allowlist, boss-arena single-enemy generation, new rare-variant pairs.
- `src/engine/save.ts` — `SAVE_VERSION` bump; migration mapping legacy area ids (`forest`→`forest-1`, `caves`→`cave-1`, `mines`→`mine-1`) for saves with an active run.
- `src/ui/components/organisms/guild-pane.tsx`, `src/ui/context.tsx` (areaSel default), hub-page keyboard navigation, UI smoke tests.
- No new data extraction: `map-spawns.json`, `enemy-stats.json`, and both Ep1 drop tables already carry everything needed.
