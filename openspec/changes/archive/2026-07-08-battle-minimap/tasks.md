# Battle Minimap — Tasks

## 1. Geometry extraction

- [x] 1.1 Write `scripts/extract-room-geometry.mjs`: read `room-layout-index.json` from the newserv clone, parse layout variants from each Ep1 offline variation filename in `map-spawns.json` (multi-layout `map_<area>_<layout>_<entities>_offe.dat`; single-layout → variant 0), map floors to area ids per newserv `default_floor_to_area` (Ep1 `0x00-0x11`, cite `Map.cc:68-92`), and emit `src/engine/data/room-geometry.json` (episode → floor → layoutKey → `[{room, x, z}]`). Exit non-zero listing any variation that fails to parse or join.
- [x] 1.2 Add `extract:room-geometry` npm script; run it and commit the generated JSON. Sanity-check counts (Forest 1: 1 layout / 16 rooms; Cave/Mine/Ruins floors: 3 layouts each).
- [x] 1.3 Write `src/engine/data/room-geometry.ts` loader exposing `getRoomGeometry(episode, floor, layoutKey)` with types, mirroring the `map-spawns.ts` wrapper style.

## 2. Engine provenance (no behavior change)

- [x] 2.1 Add optional `authRoom` to `RoomDef` (`src/engine/areas.ts`) and `layoutKey` to `Stage` (`src/engine/stage-gen.ts`); populate them in `generateStage` from `SpawnWave.room` and the rolled variation's filename — no RNG consumption, no reordering; split rooms share their wave's `authRoom`.
- [x] 2.2 Surface the minimap inputs to the UI: extend `RunProgress` (or the run snapshot the scene reducer sees) with `layoutKey` and the per-room `authRoom` plan, keeping it outcome-blind (plan-level data only, never the truncated `roomPlan`).
- [x] 2.3 Add a replay-determinism regression test: simulate fixed `(runId, seed)` runs across representative areas and assert battle-log output is byte-identical to pre-change snapshots; assert `generateStage` tags every room with a valid `authRoom` and a `layoutKey` present in room-geometry data.
- [x] 2.4 Audit persisted run-state shapes for embedded `RoomDef`/`Stage` values; confirm new fields stay derived-only (no `SAVE_VERSION` bump) and old saves load. Add a load test if any shape was touched.

## 3. Minimap UI

- [x] 3.1 Implement the minimap state function (pure, alongside `scene.ts` helpers): from geometry + room plan + folded scene, produce per-authentic-room state (`unvisited`/`current`/`cleared`) plus structural cells for geometry rooms absent from the spawn plan; unit-test split-room completion, doomed-run indistinguishability, and reload refold equivalence.
- [x] 3.2 Replace `.progress` bar + `.stage-rooms` strip in `run-page.tsx` and `stage.ts` with a `.stage-minimap` container of absolutely positioned cells (aspect-fit normalization of x/z extents, fixed max height); keep the `Room N/M` readout; boss areas render readout only.
- [x] 3.3 Style in `battle.css` with literal global classes (`stage-minimap`, `minimap-room`, `cleared`, `current`, `unknown`), remove retired bar/`room-cell` rules; grep the repo for `.progress`, `stage-progress`, `stage-rooms`, `room-cell` usages (tests, CSS-module `:global()`) and update every hit.
- [x] 3.4 Update UI smoke tests to select on the new minimap classes and states.

## 4. Verification

- [x] 4.1 Run the full test suite (`vitest run`) and typecheck; fix fallout.
- [x] 4.2 Playcheck (verify skill): run Forest 1 (static layout) and one Cave floor twice with different seeds — confirm rooms light up as cleared, current room tracks, Cave layout differs across seeds that roll different variants, defeat run freezes without warning; capture screenshots.
- [x] 4.3 Resolve the design's open questions from the playcheck (loot glyphs on cleared cells; minimap placement) and note the decisions in design.md.
