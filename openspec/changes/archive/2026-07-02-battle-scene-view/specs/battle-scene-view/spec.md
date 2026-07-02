# battle-scene-view Specification (delta)

## ADDED Requirements

### Requirement: Classic battle stage layout
While a run is active, the run screen SHALL present a first-person battle stage in the style of classic Phantasy Star titles: a message ticker showing the most recent run event at the top, an enemy field in the middle, and a player status window at the bottom. The scrollable battle log SHALL remain available, presented below the stage.

#### Scenario: Stage shows the current room's combatants
- **WHEN** the character is fighting in a room
- **THEN** the stage SHALL show one placeholder box per enemy in that room, each labeled with the enemy's name and showing a health bar with current/max HP, and SHALL show the player status window with the character's name and a health bar with current/max HP

#### Scenario: Placeholder boxes carry sprite hooks
- **WHEN** an enemy is rendered on the stage
- **THEN** its element SHALL carry a stable identifier for the enemy definition (e.g., a `data-enemy-id` attribute) so placeholder boxes can later be replaced by sprites without structural changes

#### Scenario: Room progress and supplies are visible
- **WHEN** the stage is displayed
- **THEN** it SHALL show the current room number out of the area total and the character's remaining consumable supply

### Requirement: Scene state derived purely from revealed events
The scene (current room, each enemy's HP and alive/dead status, the character's HP) SHALL be computed by a pure reduction over the run's revealed structured events, with no dependence on rendering history.

#### Scenario: Mid-run reload reconstructs the scene
- **WHEN** the application is reloaded while a run is in progress
- **THEN** the stage SHALL show the same room, enemy HPs, and character HP as it would have shown had the application stayed open, by folding all events revealed up to the current game time

#### Scenario: Reducer is deterministic
- **WHEN** the same sequence of revealed events is folded twice
- **THEN** the resulting scene state SHALL be identical

### Requirement: Event playback with visual feedback
The stage SHALL play newly revealed events at their run timestamps with visual feedback, rather than re-rendering the whole screen on a fixed poll.

#### Scenario: Hit feedback
- **WHEN** an attack event that hits is revealed
- **THEN** the target's element SHALL show a brief hit effect and a floating damage number, and the target's health bar SHALL update to the post-hit value; critical hits SHALL be visually distinguished

#### Scenario: Miss feedback
- **WHEN** an attack event that misses is revealed
- **THEN** the stage SHALL show a "MISS" indicator on the target without changing any health bar

#### Scenario: Death feedback
- **WHEN** a kill event is revealed
- **THEN** the corresponding enemy SHALL be visually marked defeated (e.g., faded out) and SHALL no longer present a live health bar

#### Scenario: Heal and revive feedback
- **WHEN** a heal or revive event is revealed
- **THEN** the player health bar SHALL update to the post-event value with a visual cue distinct from taking damage

#### Scenario: Room transition
- **WHEN** a room event is revealed
- **THEN** the stage SHALL clear the previous room's enemies and present the new room's roster

#### Scenario: Animations survive ongoing updates
- **WHEN** multiple events are revealed while an effect is animating
- **THEN** in-flight visual effects SHALL NOT be destroyed by unrelated updates (the stage DOM persists and is updated incrementally)

#### Scenario: Background progress is not lost
- **WHEN** the tab is unfocused or rendering is throttled and later resumes
- **THEN** the stage SHALL catch up to the current game time immediately, without replaying the missed interval in real time
