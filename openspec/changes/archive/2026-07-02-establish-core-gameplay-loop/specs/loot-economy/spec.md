## ADDED Requirements

### Requirement: Drop generation
Enemies and item boxes SHALL generate drops from area/difficulty-appropriate drop tables, producing meseta, gear, and/or consumables. All drop rolls SHALL use the run's seeded RNG.

#### Scenario: Enemy produces a seeded drop
- **WHEN** an enemy dies
- **THEN** the system SHALL roll its drop from the appropriate table using the run's seeded RNG, so the same run reproduces the same drops

#### Scenario: Box produces a seeded drop
- **WHEN** an item box is opened
- **THEN** the system SHALL roll its drop from the appropriate table using the run's seeded RNG

### Requirement: Loot filter routing
Every drop SHALL pass through a player-configured loot filter that routes it to either **keep** (added to inventory) or **auto-sell** (converted to meseta). The MVP filter SHALL support at minimum a rule to auto-sell items below a configured value and to always keep flagged/rare items.

#### Scenario: Junk is auto-sold
- **WHEN** a drop matches an auto-sell rule
- **THEN** the item SHALL NOT enter inventory and its sell value SHALL be added to the player's meseta

#### Scenario: Kept items enter inventory
- **WHEN** a drop matches a keep rule (or no auto-sell rule applies)
- **THEN** the item SHALL be added to the player's inventory

### Requirement: Meseta currency
Meseta SHALL be the currency earned from drops and auto-sold items and spent in the meta layer. The player's meseta balance SHALL persist across runs.

#### Scenario: Meseta accrues from a run
- **WHEN** a run collects meseta drops and/or auto-sells items
- **THEN** the amounts SHALL be added to the player's persistent meseta balance and reflected in the run report

### Requirement: Shop purchasing
The player SHALL be able to spend meseta in the meta layer to buy consumables (healing and revive items) and grinders.

#### Scenario: Buy consumables
- **WHEN** the player buys a consumable and has sufficient meseta
- **THEN** the system SHALL deduct the price, add the consumable to the player's stock, and reject the purchase if meseta is insufficient

### Requirement: Inventory
Collected items SHALL be stored in an inventory the player can view in the meta layer, and from which items can be equipped or sold.

#### Scenario: Sell an inventory item
- **WHEN** the player sells an item from inventory
- **THEN** the item SHALL be removed from inventory and its sell value added to meseta

### Requirement: Run report
When a run ends (complete or ejected), the system SHALL present a report summarizing loot collected, meseta gained, consumables used, and the run outcome.

#### Scenario: Report shown on run end
- **WHEN** a run ends by completion or ejection
- **THEN** the system SHALL display a run report listing collected items, meseta gained, consumables consumed, and whether the run completed or ejected
