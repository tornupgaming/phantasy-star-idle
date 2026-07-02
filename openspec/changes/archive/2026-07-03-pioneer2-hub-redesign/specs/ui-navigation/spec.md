## MODIFIED Requirements

### Requirement: Screen router
The UI SHALL present exactly one screen at a time from: character select, character create, Pioneer 2 hub, and run view. The hub SHALL contain an internal pane selection (Hunters Guild, Weapon Shop, Armour Shop, Tool Shop, Equipment, Inventory/Bank) rendered inside a persistent hub shell. While a run is active, the run view SHALL override all other screens. Screen and pane state SHALL be UI-local and not persisted: every application load with no active run SHALL start on the character select screen, and every entry to the hub SHALL start on the Hunters Guild pane.

#### Scenario: Boot to character select
- **WHEN** the application loads and no run is active
- **THEN** the character select screen SHALL be shown

#### Scenario: Active run overrides navigation
- **WHEN** a run is active
- **THEN** the run view SHALL be shown regardless of prior screen state, and no other screen SHALL be reachable until the run settles

#### Scenario: Reload during a run
- **WHEN** the application loads while a run is active in the save
- **THEN** the run view SHALL be shown directly

#### Scenario: Hub entry lands on Hunters Guild
- **WHEN** the player navigates to the hub from character select or create, or a run settles
- **THEN** the Hunters Guild pane SHALL be the active pane

### Requirement: Pioneer 2 hub
The Pioneer 2 hub SHALL be a master-detail shell: a persistent status bar across the top, a persistent sidebar listing the entries Hunters Guild, Weapon Shop, Armour Shop, Tool Shop, Equipment, Inventory/Bank, and Change Character, and a detail region rendering the active pane. Activating a sidebar entry SHALL switch the detail region to that pane without leaving the hub, with the active entry visually highlighted; Change Character SHALL instead exit to the character select screen. The Hunters Guild pane SHALL present the quest counter — area, difficulty, attack pattern, loot filter, supply summary, and an accept-quest action that dispatches the run.

#### Scenario: Switch panes from the sidebar
- **WHEN** the player activates a sidebar entry other than Change Character
- **THEN** the corresponding pane SHALL render in the detail region with the sidebar entry highlighted, and the status bar and sidebar SHALL remain visible

#### Scenario: Accept quest dispatches a run
- **WHEN** the player activates the accept-quest action on the Hunters Guild pane with a valid configuration
- **THEN** the run SHALL be dispatched and the run view shown

#### Scenario: Change character
- **WHEN** the player activates the Change Character sidebar entry and no run is active
- **THEN** the character select screen SHALL be shown

### Requirement: Shop and bank sub-screens
The Weapon Shop, Armour Shop, Tool Shop, and Inventory/Bank SHALL each be a hub pane in a shared list-plus-detail shape: an item list with a highlight bar and a detail area describing the highlighted entry. The Weapon Shop pane SHALL list the character's weapon stock and the Armour Shop pane the character's armour stock (frames, barriers, and units), each with buy actions and, for equippable offers, a stat preview of equipping the offer. The Tool Shop pane SHALL list consumables and grinders with buy actions. The Inventory/Bank pane SHALL list the shared inventory with equip and sell actions.

#### Scenario: Buy from a shop pane
- **WHEN** the player activates a buy action on a listed offer with sufficient meseta
- **THEN** the purchase SHALL be applied and the pane re-rendered with updated stock and meseta

#### Scenario: Shop offer shows stat preview
- **WHEN** the player highlights a weapon or armour offer equippable by the selected character
- **THEN** the detail area SHALL show the stat change the character would receive by equipping it

#### Scenario: Equip from Inventory/Bank
- **WHEN** the player activates equip on an inventory item compatible with the selected character
- **THEN** the item SHALL be equipped to the selected character

### Requirement: Post-run report on the hub
When a run settles, the UI SHALL navigate to the Pioneer 2 hub's Hunters Guild pane and present the run report as a dismissible dialog window there, regardless of which screen or pane was notionally current. Dismissing the dialog SHALL not clear the underlying report state.

#### Scenario: Run settles into hub report
- **WHEN** an active run settles
- **THEN** the hub SHALL be shown on the Hunters Guild pane with the run report presented as a dialog

#### Scenario: Dismiss the report
- **WHEN** the player dismisses the report dialog
- **THEN** the hub SHALL remain shown without the dialog

## ADDED Requirements

### Requirement: Hub status bar
Every hub pane SHALL display a status bar at the top of the shell showing the selected character's name, class, section ID, and level, their total XP and XP remaining to the next level (or a max-level indication at the level cap), and the shared meseta balance and grinder count. The status bar SHALL reflect state changes (purchases, XP, level-ups) on re-render. The character select, character create, and run views SHALL NOT display the hub status bar.

#### Scenario: Status bar content
- **WHEN** any hub pane is shown
- **THEN** the status bar SHALL show name, class, section ID, level, total XP, XP to next level, meseta, and grinders for the selected character and shared economy

#### Scenario: Status bar updates on purchase
- **WHEN** the player completes a purchase on any shop pane
- **THEN** the status bar's meseta value SHALL reflect the new balance

### Requirement: Equipment pane
The Equipment pane SHALL implement the PSO-style equip flow: a slot list (weapon, frame, barrier, and unit slots with capacity shown), a candidate list for the selected slot drawn from the shared inventory items equippable in that slot plus a remove option when the slot is occupied, and a stat preview area. Highlighting a candidate SHALL show, per stat, the character's current value and the value as-if the candidate were equipped, with increase/decrease markers, without committing any change. A confirm action SHALL equip the highlighted candidate (or remove the equipped item when the remove option is confirmed). Weapon grinding SHALL be available from this pane when a weapon is equipped.

#### Scenario: Browse candidates for a slot
- **WHEN** the player selects the weapon slot
- **THEN** the candidate list SHALL show the inventory's weapons and, if a weapon is equipped, a remove option

#### Scenario: Preview does not commit
- **WHEN** the player highlights a candidate without confirming
- **THEN** the preview SHALL show current and as-if-equipped stat values with change markers, and the character's equipment SHALL remain unchanged

#### Scenario: Confirm equips the candidate
- **WHEN** the player confirms a highlighted candidate
- **THEN** the item SHALL be equipped to that slot, any displaced item SHALL return to the shared inventory, and the pane SHALL re-render with updated stats

#### Scenario: Grind from the Equipment pane
- **WHEN** a weapon is equipped and the player activates the grind action with at least one grinder
- **THEN** the weapon's grind SHALL increase by one up to its cap and a grinder SHALL be consumed
