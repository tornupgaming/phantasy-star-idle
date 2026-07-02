## ADDED Requirements

### Requirement: Screen router
The UI SHALL present exactly one screen at a time from: character select, character create, Pioneer 2 hub, weapon & armor shop, tool shop, bank, and run view. While a run is active, the run view SHALL override all other screens. Screen state SHALL be UI-local and not persisted: every application load with no active run SHALL start on the character select screen.

#### Scenario: Boot to character select
- **WHEN** the application loads and no run is active
- **THEN** the character select screen SHALL be shown

#### Scenario: Active run overrides navigation
- **WHEN** a run is active
- **THEN** the run view SHALL be shown regardless of prior screen state, and no other screen SHALL be reachable until the run settles

#### Scenario: Reload during a run
- **WHEN** the application loads while a run is active in the save
- **THEN** the run view SHALL be shown directly

### Requirement: Character select screen
The character select screen SHALL show one card per roster character displaying name, class, level, and section ID, in a horizontally flowing grid that scrolls when the roster outgrows the viewport, plus a trailing empty-slot card. Selecting a character card SHALL make it the selected character and navigate to the Pioneer 2 hub. Selecting the empty-slot card SHALL open the character create screen. Character deletion SHALL be available from this screen (with confirmation) and from no other screen.

#### Scenario: Select a character
- **WHEN** the player activates a character card
- **THEN** that character SHALL become the selected character and the Pioneer 2 hub SHALL be shown

#### Scenario: Start creation from empty slot
- **WHEN** the player activates the empty-slot card
- **THEN** the character create screen SHALL be shown

#### Scenario: Delete from select screen
- **WHEN** the player activates a card's delete control and confirms
- **THEN** the character SHALL be deleted and the select screen re-rendered

### Requirement: Character create flow
The character create screen SHALL follow PSO Blue Burst order: the player SHALL first choose a class from the class list (with a base-stat preview of the highlighted class), then enter a name. The derived section ID SHALL be displayed live as the name is typed. An explicit section-ID override SHALL be available but visually subordinate (behind a disclosure), defaulting to the derived value. Confirming creation SHALL create the character, select it, and navigate to the Pioneer 2 hub.

#### Scenario: Class-first order with preview
- **WHEN** the player highlights a class in the class list
- **THEN** that class's base stats SHALL be shown in a preview pane

#### Scenario: Derived section ID shown live
- **WHEN** the player types a name
- **THEN** the section ID derived from the name SHALL be displayed and used unless overridden

#### Scenario: Creation completes into the hub
- **WHEN** the player confirms creation with a valid name and class
- **THEN** the new character SHALL be created and selected, and the Pioneer 2 hub SHALL be shown

### Requirement: Pioneer 2 hub
The Pioneer 2 hub SHALL be a full-width three-column screen: (left) the selected character's identity, stats, and equipment with equip/unequip/grind actions; (center) the Hunter's Guild counter — area, difficulty, attack pattern, loot filter, supply summary, and an accept-quest action that dispatches the run; (right) a counter directory with navigation to the weapon & armor shop, tool shop, and bank, plus a change-character action returning to character select.

#### Scenario: Accept quest dispatches a run
- **WHEN** the player activates the accept-quest action with a valid configuration
- **THEN** the run SHALL be dispatched and the run view shown

#### Scenario: Navigate to a counter
- **WHEN** the player activates a counter directory entry
- **THEN** the corresponding sub-screen (weapon & armor shop, tool shop, or bank) SHALL be shown

#### Scenario: Change character
- **WHEN** the player activates the change-character action and no run is active
- **THEN** the character select screen SHALL be shown

### Requirement: Shop and bank sub-screens
The weapon & armor shop, tool shop, and bank SHALL each be a distinct full-screen view in a shared list-plus-detail shape: an item list pane with a highlight bar, and a detail pane describing the highlighted entry. The weapon & armor shop SHALL list the gear shop stock with buy actions; the tool shop SHALL list consumables and grinders with buy actions; the bank SHALL list the shared inventory with equip and sell actions. Each sub-screen SHALL provide a leave action returning to the hub.

#### Scenario: Buy from a shop
- **WHEN** the player activates a buy action on a listed offer with sufficient meseta
- **THEN** the purchase SHALL be applied and the screen re-rendered with updated stock and meseta

#### Scenario: Equip from the bank
- **WHEN** the player activates equip on a bank item compatible with the selected character
- **THEN** the item SHALL be equipped to the selected character

#### Scenario: Leave returns to hub
- **WHEN** the player activates the leave action on any sub-screen
- **THEN** the Pioneer 2 hub SHALL be shown

### Requirement: Post-run report on the hub
When a run settles, the UI SHALL navigate to the Pioneer 2 hub and present the run report as a dismissible dialog window there, regardless of which screen was notionally current. Dismissing the dialog SHALL not clear the underlying report state.

#### Scenario: Run settles into hub report
- **WHEN** an active run settles
- **THEN** the Pioneer 2 hub SHALL be shown with the run report presented as a dialog

#### Scenario: Dismiss the report
- **WHEN** the player dismisses the report dialog
- **THEN** the hub SHALL remain shown without the dialog
