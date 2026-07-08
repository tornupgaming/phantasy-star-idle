# ui-navigation Specification (delta)

## MODIFIED Requirements

### Requirement: Pioneer 2 hub
The Pioneer 2 hub SHALL be a HUD shell over the scene layer: the persistent player HUD capsule and XP/economy side panel along the top, a persistent floating "Pioneer 2" navigation window listing the entries Hunters Guild, Weapon Shop, Armour Shop, Tool Shop, Equipment, Inventory/Bank, and Change Character, a pane region rendering the active pane's window(s), and a dialogue window along the bottom. Activating a navigation entry SHALL switch the pane region to that pane without leaving the hub, with the active entry visually highlighted; Change Character SHALL instead exit to the character select screen. The Hunters Guild pane SHALL present the quest counter across its two panels using PSO menu idioms rather than raw form controls. The central panel SHALL hold episode, difficulty, and attack pattern as selectable chip rows (episode offering Episode 1 with Episodes 2 and 4 visible but disabled), the accept-quest action that dispatches the run, and the loot filter and supply summary in a subordinate settings window. The detail (right) panel SHALL hold the destination list: a highlightable menu of the selectable areas (name plus recommended ATP) grouped under non-interactive zone headings (Forest, Caves, Mines, Ruins), with boss arenas visually distinguished. Native select elements SHALL NOT appear on the guild pane.

#### Scenario: Switch panes from the navigation window
- **WHEN** the player activates a navigation entry other than Change Character
- **THEN** the corresponding pane SHALL render in the pane region with the nav entry highlighted, and the player HUD capsule, side panel, and navigation window SHALL remain visible

#### Scenario: Accept quest dispatches a run
- **WHEN** the player activates the accept-quest action on the Hunters Guild pane with a valid configuration
- **THEN** the run SHALL be dispatched and the run view shown

#### Scenario: Change character
- **WHEN** the player activates the Change Character navigation entry and no run is active
- **THEN** the character select screen SHALL be shown

#### Scenario: Guild counter uses menu idioms
- **WHEN** the Hunters Guild pane is shown
- **THEN** the destination SHALL be chosen from the grouped menu list in the detail panel and episode, difficulty, and attack pattern from chip rows in the central panel, with no native select elements present

#### Scenario: Destination list is zone-grouped
- **WHEN** the Hunters Guild pane is shown
- **THEN** the detail panel SHALL list every selectable area under its zone heading in catalog display order, with the selected area highlighted and keyboard traversal skipping the headings

#### Scenario: Disabled episodes are not selectable
- **WHEN** the player attempts to activate the Episode 2 or Episode 4 chip
- **THEN** the selected episode SHALL remain Episode 1 and the destination list SHALL be unchanged
