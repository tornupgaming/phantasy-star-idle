# battle-scene-view Specification

## Purpose
Present an in-run battle scene in the style of classic Phantasy Star titles: a first-person stage with enemy boxes, the player HUD capsule as the player status display, and event-driven visual feedback, derived purely from the run's revealed structured events. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Classic battle stage layout
While a run is active, the run screen SHALL present a first-person battle stage in the style of classic Phantasy Star titles: the shared PSO player HUD capsule anchored top-left of the run screen (the same anchor position as on the hub), a message ticker showing the most recent run event at the top of the stage, and an enemy field in the middle. The scrollable battle log SHALL remain available, presented below the stage. There SHALL be no separate player status window at the bottom of the stage; the capsule is the player status display.

#### Scenario: Stage shows the current room's combatants
- **WHEN** the character is fighting in a room
- **THEN** the stage SHALL show one placeholder box per enemy in that room, each labeled with the enemy's name and showing a health bar with current/max HP, and the player HUD capsule SHALL show the character's name and a health bar with current/max HP

#### Scenario: Placeholder boxes carry sprite hooks
- **WHEN** an enemy is rendered on the stage
- **THEN** its element SHALL carry a stable identifier for the enemy definition (e.g., a `data-enemy-id` attribute) so placeholder boxes can later be replaced by sprites without structural changes

#### Scenario: Room progress and supplies are visible
- **WHEN** the stage is displayed
- **THEN** it SHALL show the current room number out of the area total and the character's remaining consumable supply, presented in the stage's bottom strip rather than inside the player HUD capsule

### Requirement: Stage handles dynamically spawned enemies
The battle scene SHALL support enemies that appear after a room event by appending them to the current room state from structured spawn events.

#### Scenario: Spawn event adds an enemy box
- **WHEN** a spawn event is revealed for the current room
- **THEN** the stage SHALL add one enemy placeholder box for the spawned enemy, labeled with its name, initialized to its max HP, and carrying the spawned enemy's stable definition id

#### Scenario: Spawned enemy participates in later feedback
- **WHEN** later attack or kill events reference the spawned enemy's roster index
- **THEN** the stage SHALL apply hit, miss, health-bar, and death feedback to the spawned enemy's element as it would for an enemy present at room entry

#### Scenario: Spawned enemies reconstruct after reload
- **WHEN** the application is reloaded after one or more spawn events have been revealed in the current room
- **THEN** folding the revealed events SHALL reconstruct the current room with the same appended enemies, HP values, and defeated states as uninterrupted playback

### Requirement: Scene state derived purely from revealed events
The scene (current room, each initial or dynamically spawned enemy's HP and alive/dead status, and the character's HP) SHALL be computed by a pure reduction over the run's revealed structured events, with no dependence on rendering history.

#### Scenario: Mid-run reload reconstructs the scene
- **WHEN** the application is reloaded while a run is in progress
- **THEN** the stage SHALL show the same room, enemy HPs, dynamically spawned enemies, and character HP as it would have shown had the application stayed open, by folding all events revealed up to the current game time

#### Scenario: Reducer is deterministic
- **WHEN** the same sequence of revealed events is folded twice
- **THEN** the resulting scene state SHALL be identical

#### Scenario: Spawn events append to the current room only
- **WHEN** a spawn event is folded after a room event
- **THEN** the reducer SHALL append the spawned enemy to the current room roster at the event's roster index without altering existing enemies

### Requirement: Event playback with visual feedback
The stage SHALL play newly revealed events at their run timestamps with visual feedback, rather than re-rendering the whole screen on a fixed poll. Floating combat text (damage numbers and the MISS indicator) SHALL render from the committed PSO bitmap glyph atlas with pixel-crisp integer scaling; if the atlas asset is unavailable, floating text SHALL fall back to plain text so combat feedback is never lost.

#### Scenario: Hit feedback
- **WHEN** an attack event that hits is revealed
- **THEN** the target's element SHALL show a brief hit effect and a floating damage number composed of bitmap glyphs from the atlas, and the target's health bar SHALL update to the post-hit value; critical hits SHALL be visually distinguished (larger scale and gold tint)

#### Scenario: Miss feedback
- **WHEN** an attack event that misses is revealed
- **THEN** the stage SHALL show a red "MISS" indicator composed of bitmap glyphs from the atlas on the target, without changing any health bar

#### Scenario: Atlas unavailable fallback
- **WHEN** the glyph atlas image fails to load
- **THEN** floating damage numbers and the MISS indicator SHALL render as plain text with the same colors and animation

#### Scenario: Log and ticker miss styling unchanged
- **WHEN** a miss event is written to the battle log or ticker
- **THEN** those lines SHALL keep their existing muted styling (only the floating MISS indicator is red)

#### Scenario: Death feedback
- **WHEN** a kill event is revealed
- **THEN** the corresponding enemy SHALL be visually marked defeated (e.g., faded out) and SHALL no longer present a live health bar

#### Scenario: Heal and revive feedback
- **WHEN** a heal or revive event is revealed
- **THEN** the player health bar SHALL update to the post-event value with a visual cue distinct from taking damage

#### Scenario: Spawn feedback
- **WHEN** a spawn event is revealed
- **THEN** the spawned enemy SHALL appear in the enemy field without clearing existing enemies or interrupting unrelated in-flight effects

#### Scenario: Room transition
- **WHEN** a room event is revealed
- **THEN** the stage SHALL clear the previous room's enemies and present the new room's initial roster

#### Scenario: Animations survive ongoing updates
- **WHEN** multiple events are revealed while an effect is animating
- **THEN** in-flight visual effects SHALL NOT be destroyed by unrelated updates (the stage DOM persists and is updated incrementally)

#### Scenario: Background progress is not lost
- **WHEN** the tab is unfocused or rendering is throttled and later resumes
- **THEN** the stage SHALL catch up to the current game time immediately, without replaying the missed interval in real time

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
