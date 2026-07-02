## ADDED Requirements

### Requirement: Dispatching a character on a run
The system SHALL allow the player to dispatch the character into a selected area at a selected difficulty from the meta layer, starting a run that resolves without further input.

#### Scenario: Send starts a run
- **WHEN** the player selects an area and difficulty and presses "send"
- **THEN** the system creates a run bound to a snapshot of the character's stats, equipment, and stocked supply, assigns the run a unique id and RNG seed, and begins advancing it

#### Scenario: Only one active run at a time
- **WHEN** a run is already active
- **THEN** the system SHALL NOT start a second run and SHALL require the active run to end (complete or eject) first

### Requirement: Room-by-room progression
An area SHALL consist of an ordered list of rooms, each containing zero or more enemies and zero or more item boxes. The run SHALL clear rooms in order.

#### Scenario: Room must be cleared of enemies before boxes open
- **WHEN** the character enters a room containing enemies
- **THEN** the system SHALL resolve combat against those enemies before any item box in that room is opened

#### Scenario: Boxes open only after the room is clear
- **WHEN** a room has no remaining living enemies
- **THEN** the system SHALL open every item box in that room and resolve their drops, then advance the character to the next room

#### Scenario: Reaching the end completes the run
- **WHEN** the character clears the final room of the area
- **THEN** the run SHALL end as **complete** and return the character to the meta layer with a run report

### Requirement: Auto-loot on kill and on box open
Loot SHALL be collected automatically; the player never manually grabs items during a run.

#### Scenario: Enemy drop collected on death
- **WHEN** an enemy's HP reaches 0
- **THEN** the system SHALL immediately resolve and collect that enemy's drop (routed through the loot filter) before continuing

#### Scenario: Box drop collected on open
- **WHEN** an item box is opened
- **THEN** the system SHALL resolve and collect its drop (routed through the loot filter)

### Requirement: Background ticking
A run SHALL progress on a game clock independently of whether its view is focused or visible.

#### Scenario: Progress continues while unfocused
- **WHEN** the run view is not focused and game time elapses
- **THEN** the run SHALL continue advancing rooms, combat, and loot at the same rate as when focused

### Requirement: Deterministic resume from a seed
A run SHALL be reconstructible from its stored `(character snapshot, area, seed, start time)` such that re-simulating elapsed time reproduces the identical battle log and loot.

#### Scenario: Reload mid-run reproduces state
- **WHEN** the application is closed and reopened while a run was in progress
- **THEN** the system SHALL fast-forward the run to the current game time and the resulting battle log and collected loot SHALL be identical to an uninterrupted run

#### Scenario: All randomness is seeded
- **WHEN** any random outcome occurs during a run (hit, miss, crit, damage variance, drop roll)
- **THEN** the value SHALL be drawn from the run's seeded RNG stream and SHALL NOT use any non-reproducible source of randomness

### Requirement: Battle log
The system SHALL produce a human-readable, scrollable log of run events (attacks, hits/misses, crits, kills, box opens, loot, heals, ejection) that the player MAY read or ignore.

#### Scenario: Log records combat and loot events
- **WHEN** an attack lands, an enemy dies, a box opens, or loot is collected
- **THEN** the system SHALL append a corresponding entry to the run's battle log
