# room-geometry-data Specification

## Purpose
Provide authentic per-floor room geometry extracted from the newserv reference — a generated dataset mapping each Ep1 non-boss floor and layout variant to its room positions, a filename-based join from spawn variations to layout variants, and stage-level room provenance that never alters the simulation. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Generated room-geometry dataset from the newserv reference
The project SHALL provide a generated data file mapping each Ep1 non-boss floor and layout variant to its authentic room positions (`room id → x/z position`), extracted from the newserv clone's `system/maps/room-layout-index.json` by a repeatable script following the existing data-extraction pattern (script in `scripts/`, npm alias, generated JSON under `src/engine/data/` with a typed loader). The dataset SHALL NOT be hand-edited.

#### Scenario: Extraction is repeatable
- **WHEN** the extraction script is run against the newserv clone
- **THEN** it SHALL regenerate the room-geometry data file deterministically, covering every layout variant reachable from the Ep1 offline spawn variations

#### Scenario: Extraction fails loudly on a broken join
- **WHEN** an Ep1 offline spawn variation's filename cannot be parsed into a layout variant, or its derived geometry key is missing from the layout index
- **THEN** the script SHALL exit non-zero and list the failing variations, rather than emitting a partial dataset

### Requirement: Spawn variations join to layout variants by filename
The layout variant for a spawn variation SHALL be derived from its source filename: multi-layout floors encode it as the first numeric token after the area name (e.g. `map_cave02_01_00_offe.dat` → layout variant 1), and single-layout floors SHALL resolve to layout variant 0. The floor-to-area-id mapping SHALL mirror newserv's `default_floor_to_area` table for Episode 1.

#### Scenario: Multi-layout floor resolves its variant
- **WHEN** stage generation rolls the Cave 1 spawn variation sourced from `map_cave02_01_00_offe.dat`
- **THEN** the resolved geometry SHALL be Cave 1's layout variant 1 room set

#### Scenario: Single-layout floor resolves to variant zero
- **WHEN** stage generation rolls any Forest 1 spawn variation
- **THEN** the resolved geometry SHALL be Forest 1's sole layout (variant 0), regardless of which entity variation was rolled

### Requirement: Stage exposes room provenance without altering simulation
Stage generation SHALL tag each generated room with the authentic room id of the spawn wave it was derived from, and SHALL record the rolled layout's geometry key on the stage, as derived metadata only. Attaching provenance SHALL NOT consume RNG, reorder rooms, change enemy or box contents, or alter any simulated outcome: for a fixed `(runId, seed)`, the battle log and loot SHALL be identical to the pre-provenance implementation. Provenance SHALL be recomputed from `(runId, seed)` and SHALL NOT require persisted-save changes.

#### Scenario: Split rooms share their authentic room id
- **WHEN** a spawn wave larger than the per-room enemy cap is split into multiple generated rooms
- **THEN** every generated room from that wave SHALL carry the same authentic room id

#### Scenario: Replay determinism is preserved
- **WHEN** a run is simulated for a fixed `(runId, seed)` before and after provenance tagging is introduced
- **THEN** the battle logs SHALL be byte-identical

#### Scenario: Old saves load unchanged
- **WHEN** a save created before this change is loaded
- **THEN** it SHALL deserialize without migration and active runs SHALL resume with provenance derived at stage regeneration
