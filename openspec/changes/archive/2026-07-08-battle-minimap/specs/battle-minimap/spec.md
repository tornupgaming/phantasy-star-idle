# battle-minimap Delta Specification

## ADDED Requirements

### Requirement: Spatial minimap replaces the linear progress display
While a run is active on a non-boss area, the battle stage SHALL display a minimap of the floor: one cell per authentic room, positioned by the rolled layout's room geometry (top-down x/z, aspect-fit to the minimap box). The minimap SHALL be rendered by the imperative stage island using literal global CSS classes (container and per-room state classes) so tests and the island's string-built DOM can target them. A compact numeric room readout (e.g. "Room 3/7", counting generated rooms) SHALL remain visible. Boss areas SHALL show only the numeric readout.

#### Scenario: Rooms render at layout positions
- **WHEN** a run on Forest 1 is displayed
- **THEN** the minimap SHALL render one cell per room of Forest 1's layout at positions derived from the extracted geometry, identical across runs that rolled the same layout

#### Scenario: Deterministic across reload
- **WHEN** the application is reloaded mid-run
- **THEN** the regenerated stage SHALL yield the same layout key, room set, and cell positions as before the reload

#### Scenario: Boss arena shows no minimap
- **WHEN** a run on a boss area is displayed
- **THEN** no minimap SHALL render and the numeric room readout SHALL remain

### Requirement: Room states reflect revealed progress only
Each minimap room SHALL derive its state purely from the planned stage and revealed events: **current** when the currently revealed room maps to it, **cleared** when every generated room tagged with it has been cleared in revealed events, otherwise **unvisited**. Rooms present in the layout geometry but absent from the rolled spawn variation SHALL render as structural cells that never become current or cleared. All cells SHALL render from the first frame with contents concealed until revealed; no minimap element SHALL be derivable into the run's outcome or remaining duration before the run settles.

#### Scenario: Split rooms complete their authentic room together
- **WHEN** a spawn wave was split into two generated rooms and only the first has been cleared
- **THEN** the authentic room SHALL remain in the current state, becoming cleared only after the second generated room is cleared

#### Scenario: Doomed run gives no advance warning
- **WHEN** a run that will end in defeat is in progress
- **THEN** the minimap SHALL behave identically to a successful run over the same revealed events, freezing in place when the run settles rather than signaling the outcome early

#### Scenario: Reload reproduces the same states
- **WHEN** the application is reloaded mid-run
- **THEN** folding the revealed events SHALL produce the same set of current/cleared/unvisited cells as uninterrupted playback
