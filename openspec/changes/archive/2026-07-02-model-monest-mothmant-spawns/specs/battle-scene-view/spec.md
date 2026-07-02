## ADDED Requirements

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

## MODIFIED Requirements

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
