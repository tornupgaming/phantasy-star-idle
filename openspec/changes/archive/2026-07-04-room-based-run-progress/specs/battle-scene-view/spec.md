## ADDED Requirements

### Requirement: Outcome-blind room-based progress bar
The stage progress bar SHALL represent progress through the area's planned rooms, not elapsed time against the run's simulated end time. Fill SHALL be computed from revealed events only, as `(roomsCleared + killsInCurrentRoom / enemiesInCurrentRoom) / totalRooms`, where `totalRooms` is the area's planned room count and the current-room term uses the current room's revealed roster size (including dynamically spawned enemies). No element of the run screen SHALL be derivable into the run's outcome or its remaining duration before the run settles.

#### Scenario: Bar reflects rooms, not time-to-end
- **WHEN** a run is in progress and the character has cleared 2 of 7 rooms with half the current room's enemies killed
- **THEN** the progress bar fill SHALL be approximately (2 + 0.5) / 7 of full width, regardless of how much simulated time remains

#### Scenario: Failing run gives no advance warning
- **WHEN** a run that will end in defeat is in progress
- **THEN** the progress bar SHALL behave identically to a successful run over the same revealed events, stopping partway when the run settles rather than approaching 100% at the moment of death

#### Scenario: Bar label shows room counts instead of a percentage
- **WHEN** the stage progress bar is displayed
- **THEN** its label SHALL present progress in rooms (e.g., "Room 3/7") rather than a percentage of elapsed run time

#### Scenario: Reload reproduces the same fill
- **WHEN** the application is reloaded mid-run
- **THEN** folding the revealed events SHALL produce the same progress bar fill as uninterrupted playback

### Requirement: Room grid shows all planned rooms with unknown placeholders
The stage room grid SHALL always render one cell per planned room in the area, regardless of how many rooms the pre-simulated result reached. Rooms the character has not yet entered SHALL render as unknown placeholders (no enemy or box counts), and each cell SHALL reveal its contents only when the corresponding room event is revealed.

#### Scenario: Doomed run shows a full-length grid
- **WHEN** a run that will end in defeat in room 3 of 7 is in progress
- **THEN** the room grid SHALL show 7 cells from the first frame, with rooms 4-7 as unknown placeholders

#### Scenario: Cells reveal on entry
- **WHEN** a room event for room N is revealed
- **THEN** room N's cell SHALL display its enemy and box counts and be marked as the current room, while later rooms remain unknown placeholders

#### Scenario: Cleared rooms stay revealed
- **WHEN** the character has cleared room N and moved on
- **THEN** room N's cell SHALL remain revealed and be marked cleared
