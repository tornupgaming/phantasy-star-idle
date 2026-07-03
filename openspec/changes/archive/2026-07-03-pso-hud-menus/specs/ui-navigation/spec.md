# ui-navigation — delta

## MODIFIED Requirements

### Requirement: Pioneer 2 hub
The Pioneer 2 hub SHALL be a HUD shell over the scene layer: a persistent status cluster and money pod along the top, a persistent floating "Pioneer 2" navigation window listing the entries Hunters Guild, Weapon Shop, Armour Shop, Tool Shop, Equipment, Inventory/Bank, and Change Character, a pane region rendering the active pane's window(s), and a dialogue window along the bottom. Activating a navigation entry SHALL switch the pane region to that pane without leaving the hub, with the active entry visually highlighted; Change Character SHALL instead exit to the character select screen. The Hunters Guild pane SHALL present the quest counter — area, difficulty, attack pattern, loot filter, supply summary, and an accept-quest action that dispatches the run — using PSO menu idioms rather than raw form controls: the area as a highlightable menu list (name plus recommended ATP), difficulty and attack pattern as selectable chip rows, and the loot filter and supply summary in a subordinate settings window. Native select elements SHALL NOT appear on the guild pane.

#### Scenario: Switch panes from the navigation window
- **WHEN** the player activates a navigation entry other than Change Character
- **THEN** the corresponding pane SHALL render in the pane region with the nav entry highlighted, and the status cluster, money pod, and navigation window SHALL remain visible

#### Scenario: Accept quest dispatches a run
- **WHEN** the player activates the accept-quest action on the Hunters Guild pane with a valid configuration
- **THEN** the run SHALL be dispatched and the run view shown

#### Scenario: Change character
- **WHEN** the player activates the Change Character navigation entry and no run is active
- **THEN** the character select screen SHALL be shown

#### Scenario: Guild counter uses menu idioms
- **WHEN** the Hunters Guild pane is shown
- **THEN** the area SHALL be chosen from a menu list and difficulty and attack pattern from chip rows, with no native select elements present

### Requirement: Hub status bar
Every hub pane SHALL display a status cluster anchored top-left showing the selected character's name, class, section ID, and level (the level in a hexagonal chip), and their XP progression — total XP plus XP remaining to the next level rendered with a thin progress bar (or a max-level indication at the level cap). The shared meseta balance and grinder count SHALL be shown in a compact money pod anchored top-right. Both SHALL reflect state changes (purchases, XP, level-ups) on re-render. The character select, character create, and run views SHALL NOT display the hub status cluster or money pod.

#### Scenario: Status cluster content
- **WHEN** any hub pane is shown
- **THEN** the status cluster SHALL show name, class, section ID, level chip, total XP, and XP-to-next progress, and the money pod SHALL show meseta and grinders

#### Scenario: Money pod updates on purchase
- **WHEN** the player completes a purchase on any shop pane
- **THEN** the money pod's meseta value SHALL reflect the new balance

## ADDED Requirements

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
