# ui-navigation Specification

## Purpose
Define the UI's screen structure and navigation: a single-screen router across character select, character create, the Pioneer 2 hub, shop/bank sub-screens, and the run view, including run-override behavior and the post-run report flow. (TBD: refine as the capability evolves.)

## Requirements

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

### Requirement: Hub status bar
Every hub pane SHALL display the shared PSO player HUD capsule anchored top-left (see the `player-hud` capability for its anatomy: hex icon with Photon Blast badge, HP and TP bars, level pill, section ID glyph and yellow name). Immediately adjacent to the capsule, the hub SHALL display a side panel window showing the character's XP progression — total XP plus XP remaining to the next level rendered with a thin progress bar (or a max-level indication at the level cap) — and the shared economy: meseta balance and grinder count. Both SHALL reflect state changes (purchases, XP, level-ups) on re-render. There SHALL be no separate money pod window, and the class name SHALL NOT appear in the hub HUD. The character select and character create screens SHALL NOT display the capsule or side panel; the run view SHALL display the capsule (per `battle-scene-view`) but NOT the side panel.

#### Scenario: Hub HUD content
- **WHEN** any hub pane is shown
- **THEN** the top-left SHALL show the player HUD capsule, and the adjacent side panel SHALL show total XP, XP-to-next progress, meseta, and grinders

#### Scenario: Side panel updates on purchase
- **WHEN** the player completes a purchase on any shop pane
- **THEN** the side panel's meseta value SHALL reflect the new balance

#### Scenario: Side panel is hub-only
- **WHEN** a run is active and the run screen is shown
- **THEN** the player HUD capsule SHALL be visible but the XP/economy side panel SHALL NOT be

### Requirement: Keyboard menu navigation
Hub menus SHALL support keyboard operation: Up/Down arrows SHALL move the highlight within the focused menu, Enter SHALL activate the highlighted row, Escape SHALL step back one level (equipment candidate list to slot list, pane content to the navigation window), and the digit keys SHALL jump directly to the corresponding navigation entry. The orange selection bar SHALL serve as the visible focus indicator. Keyboard operation SHALL be additive: all interactions SHALL remain fully operable by pointer alone.

#### Scenario: Arrow-key navigation in a list
- **WHEN** a hub menu has focus and the player presses Down then Enter
- **THEN** the highlight SHALL move to the next row and that row SHALL activate

#### Scenario: Digit shortcut jumps panes
- **WHEN** the player presses a digit key corresponding to a navigation entry while no text input is focused
- **THEN** the hub SHALL switch to that entry's pane

#### Scenario: Pointer-only remains sufficient
- **WHEN** the player uses only the pointer
- **THEN** every hub action SHALL remain reachable and operable

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
