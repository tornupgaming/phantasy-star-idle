## MODIFIED Requirements

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
