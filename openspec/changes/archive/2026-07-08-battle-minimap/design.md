# Battle Minimap — Design

## Context

Stage generation (`src/engine/stage-gen.ts:61`) already deterministically rolls a spawn variation per floor with `rng.pick(floor.offline)` and flattens its waves into a linear `RoomDef[]`, splitting at `MAX_ROOM_ENEMIES = 6`. Two pieces of authentic structure are discarded in that flattening:

- `SpawnWave.room` / `SpawnWave.wave` (`src/engine/data/map-spawns.ts:20-25`) — the authentic room each wave belongs to.
- The variation's source `file` (e.g. `map_cave02_01_00_offe.dat`) — whose first numeric token after the area name is the **layout variant** rolled.

The newserv clone ships `system/maps/room-layout-index.json` (verified: 124 keys), keyed `"<area_hex>-<layout_var_hex>"` → `{room_id_hex: [x, y, z, rotX, rotY, rotZ]}`. Per newserv (`Map.cc:152-186`), Ep1 floors have at most 3 layout variants (Forest 1/2: exactly 1); layouts are static pre-authored maps, never procedural. Wave `room` ids match the geometry index's room ids (verified on Cave 1: waves reference rooms 11-14, index key `04-…` carries those rooms).

The current progress UI is the `.progress` bar + `.stage-rooms` cell strip rendered imperatively by `stage.ts:128-131` / `stage.ts:273-291` from `RunProgress.totalRooms` and the event-folded scene. It is deliberately outcome-blind (spec: `battle-scene-view` requirements at lines 100 and 119).

## Goals / Non-Goals

**Goals:**
- Spatial minimap on the battle stage: rooms at authentic positions, states unknown → current → cleared.
- Fully deterministic: same `(runId, seed)` → same minimap; derived from the planned stage + revealed events only.
- Zero change to simulation behavior, RNG draw order, or replay output.
- Preserve outcome-blindness exactly as the bar/grid requirements specify today.

**Non-Goals:**
- Door/adjacency edges between rooms (no data source; would require geometric inference — deferred).
- Regrouping the sim's synthetic rooms to authentic room boundaries (pacing change, replay break — a possible future change).
- Hub or area-select map views; Ep2/Ep4 geometry (extract Ep1 only, but keep the data format episode-keyed).
- Boss arenas get no minimap (single room; keep the "Room 1/1" readout only).

## Decisions

### D1. Presentation-only provenance, not authentic room regrouping
`generateStage` keeps its exact flattening and split logic; each emitted `RoomDef` gains optional metadata: `authRoom: number` (from `SpawnWave.room`) and `Stage` gains `layoutKey: string` (e.g. `"04-01"`). The minimap marks an authentic room *cleared* when every synthetic room tagged with it is cleared, and *current* when the scene's `roomIndex` falls in one of its synthetic rooms.
- *Why*: regrouping waves into authentic rooms changes room counts and fight order, breaking `(runId, seed)` replay identity for existing saves — the project's hardest invariant. Provenance tagging is purely additive; a determinism test can assert battle logs are byte-identical before/after.
- *Alternative rejected*: authentic regrouping behind a stage-gen version stamp — more faithful pacing, but couples a UI feature to a save-migration decision. Can be proposed separately later.

### D2. Geometry extracted at build time, joined by filename token
New `scripts/extract-room-geometry.mjs` (pattern: `extract-map-spawns.mjs`) reads `room-layout-index.json` from the newserv clone and emits `src/engine/data/room-geometry.json` filtered to the areas/variants reachable from `map-spawns.json`'s Ep1 `offline` variations. The layout variant is parsed from the variation filename: multi-layout floors are `map_<area>_<layout>_<entities>_offe.dat`; single-layout floors (`map_forest…`) omit the layout token → variant `00`. The floor→area-id mapping mirrors newserv's `default_floor_to_area` (Ep1: contiguous `0x00-0x11`), hardcoded in the extractor with a comment citing `Map.cc:68-92`.
- *Why filename parsing*: it is the only link between a spawn variation and its layout; verified against real data for cave (explicit token) and forest (implicit 0). The extractor should fail loudly if a filename doesn't match either pattern or a joined key is missing from the index — bad joins must break the build, not render an empty map.
- *Watch out*: newserv's file basenames don't line up 1:1 with our floor names (Forest 1 uses `map_forest02_*`); derive the area id from our existing floor mapping in `map-spawns.json`, not from the name in the filename.

### D3. Geometry lookup lives in the engine data layer; positions only
`src/engine/data/room-geometry.ts` loader exposes `getRoomGeometry(episode, floor, layoutKey): { room: number; x: number; z: number }[]` (drop y and rotations; the minimap is top-down 2D). The engine itself never consumes geometry for simulation — it exists so `stage-gen` can validate `layoutKey` and so the UI has one typed access path.
- *Why in engine data*: keeps UI free of data-parsing logic per the architecture rules; mirrors how `map-spawns.ts` wraps its JSON.

### D4. Minimap renders in the `stage.ts` imperative island, canvas-free
Replace the `.progress` bar and `.stage-rooms` strip with a `.stage-minimap` container of absolutely-positioned room cells (plain DOM, global `battle.css` classes: `minimap-room`, states `cleared`/`current`/`unknown`), scaled by normalizing room x/z extents to the container box. The `Room N/M` text readout stays.
- *Why DOM over canvas*: room counts are small (Forest 1: 16), state changes are per-room-event not per-frame, and DOM cells keep the existing "tests select on literal classes" convention workable. The two existing canvas islands (Backdrop, BattleStage sprites) earn rAF; the minimap doesn't.
- Rooms not present in the spawn data (corridor/empty rooms in the geometry index) are rendered as dim structural cells but never become `current`/`cleared` — they give the floor its shape.
- All planned rooms render from the first frame (positions are plan-derived, not outcome-derived), with contents unknown until the room event reveals — same reveal discipline as the old grid.

### D5. Outcome-blindness inherited unchanged
The minimap state function takes exactly the inputs `progressFill`/`renderRooms` take today: the folded scene (revealed events) + `RunProgress.totalRooms` + the new plan-level provenance/geometry. Nothing reads the truncated `roomPlan` or the settled outcome. The `battle-scene-view` delta spec carries the two scenarios ("doomed run indistinguishable", "reload reproduces state") over to the minimap.

### D6. No save-version bump
`Stage` is regenerated from `(runId, seed)` on load; `RoomDef.authRoom`/`Stage.layoutKey` are derived, never persisted. Audit during implementation: if any persisted run snapshot embeds `RoomDef` values, keep the new fields optional so old saves deserialize unchanged — in which case still no bump.

## Risks / Trade-offs

- [Filename convention has an unnoticed variant (e.g. boss/city files)] → extractor validates every Ep1 offline variation joins to a geometry key, exits non-zero listing failures; boss floors are explicitly skipped (non-goal).
- [Geometry index positions may be room *origins*, not centroids, and rooms vary in size] → accept approximate placement (cells are abstract markers, not floor plans); normalize extents with padding. If a floor renders degenerate (overlapping cells), fall back to jittering by room id — deterministic.
- [Removing `.progress`/`room-cell` breaks UI smoke tests and any CSS-module `:global()` hooks] → grep for the retired class names as an explicit task; update tests to select on `minimap-room` states.
- [Very tall/wide floors squash in the fixed topbar slot] → aspect-fit the extent box; the minimap gets a fixed max height and letterboxes.
- [Provenance tagging accidentally perturbs RNG order] → tagging consumes no RNG; determinism test asserts identical battle log JSON for fixed seeds across the change.

## Open Questions

Both resolved during the implementation playcheck (task 4.3):

- Cleared rooms stay minimal — state color only, no loot/box glyphs. The battle
  log and loot tally already carry per-room detail; glyphs at 11px cells were
  never going to be legible, and the clean state colors read well in practice.
- Placement: same surface panel slot the bar occupied, above the Room N/M
  readout. Verified visually on Forest 1 (regular 4×4 grid) and Cave 1
  (irregular ~31-room scatter); the floor is horizontally centered in the box
  since narrow layouts otherwise hug the left edge.
