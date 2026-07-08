# Battle Minimap

## Why

The run screen's progress display is a linear bar plus a flat strip of `R1…Rn` cells, which erases the dungeon-crawl feel: PSO floors are spatial maps, and the authentic room geometry for every Ep1 floor and layout variant already exists in the newserv clone (`system/maps/room-layout-index.json`) but is unused. Our stage generation also already rolls the authentic spawn variation deterministically and each spawn wave carries its authentic room id — the data needed to place the player's run on a real floor map is being discarded at generation time.

## What Changes

- Extract authentic room geometry (per-area, per-layout-variant room positions) from the newserv clone into a new generated data file, following the existing `extract-map-spawns.mjs` pattern, and join it to spawn variations via the layout-variant token in each variation's source filename (e.g. `map_cave02_01_00_offe.dat` → layout variant `01`; single-layout floors like Forest use variant `00`).
- Expose room provenance from stage generation: each synthetic room in `Stage` records the authentic room id (from `SpawnWave.room`, currently discarded) and the rolled variation's layout key. **Presentation-only** — room sequencing, the 6-enemy split, combat, and RNG draw order are untouched, so `(runId, seed)` replays stay byte-identical.
- Replace the linear progress bar and `R1…Rn` room-cell strip on the battle stage with a spatial minimap: rooms drawn at their authentic floor positions, marked cleared (all of the room's waves defeated), current, or not-yet-visited. Rendering stays inside the imperative `stage.ts` island per the existing architecture.
- Preserve the outcome-blind guarantee: the minimap derives its state from revealed events and the planned stage only, and behaves identically for doomed and successful runs up to the moment of settling.
- Keep a compact numeric "Room N/M" readout so the at-a-glance progress count is not lost.

## Capabilities

### New Capabilities

- `room-geometry-data`: Generated room-geometry dataset (area + layout variant → room id → position) extracted from the newserv reference, the filename-based join between spawn variations and layout variants, and the provenance fields stage generation exposes so consumers can map synthetic rooms back to authentic rooms.
- `battle-minimap`: The spatial minimap on the battle stage — layout, room states (unknown/current/cleared), determinism, and outcome-blindness.

### Modified Capabilities

- `battle-scene-view`: The "Outcome-blind room-based progress bar" and "Room grid shows all planned rooms with unknown placeholders" requirements are replaced — the minimap becomes the room-progress display, inheriting their outcome-blind and reveal-on-entry behavior; the bar and cell strip are removed.

## Impact

- **Engine**: `src/engine/stage-gen.ts` (attach provenance to `RoomDef`/`Stage`), `src/engine/areas.ts` (type additions), new `src/engine/data/room-geometry.json` + loader. No combat/RNG changes; a replay-determinism test should confirm identical battle logs before/after.
- **Scripts**: new `scripts/extract-room-geometry.mjs` + npm script, reading from the newserv clone.
- **UI**: `src/ui/stage.ts` (minimap render replaces bar + room strip), `src/ui/components/pages/run-page.tsx` (markup), `src/ui/battle.css` (new `stage-*` minimap classes; `room-cell` family retired). UI smoke tests that select on `room-cell`/`progress` classes must be updated.
- **Persistence**: provenance is derived data recomputed from `(runId, seed)` at stage generation; if any persisted run-state shape gains fields, `SAVE_VERSION` needs a bump decision (design.md).
- **Non-goals**: no room-to-room door/adjacency graph (no data source exists; rooms render as positioned cells), no change to room sequencing or pacing, no minimap on the hub.
