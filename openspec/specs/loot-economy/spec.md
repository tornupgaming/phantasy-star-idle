# loot-economy Specification

## Purpose
Govern drop generation, loot-filter routing, the meseta currency, shop purchasing, inventory, and the end-of-run report. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Drop generation
Enemies and item boxes SHALL generate drops via the authentic drop generator (drop-generation capability), keyed by the character's section ID, the run's difficulty, and the area — producing meseta, gear with generated variance, usable consumables, grinders, and inert tool items. The hand-authored drop tables and placeholder gear templates SHALL be removed. All drop rolls SHALL use the run's seeded RNG.

#### Scenario: Enemy produces a seeded drop
- **WHEN** an enemy dies
- **THEN** the system SHALL roll its drop through the authentic generator using the run's seeded RNG, so the same run reproduces the same drops

#### Scenario: Box produces a seeded drop
- **WHEN** an item box is opened
- **THEN** the system SHALL roll its drop through the authentic generator using the run's seeded RNG

#### Scenario: Placeholder gear cannot drop
- **WHEN** any drop is generated
- **THEN** the resulting item SHALL be defined by the authentic item-parameter dataset, never by a hand-authored placeholder template

### Requirement: Loot filter routing
Every drop SHALL pass through a player-configured loot filter that routes it to either **keep** (added to inventory) or **auto-sell** (converted to meseta). The MVP filter SHALL support at minimum a rule to auto-sell items below a configured value and to always keep flagged/rare items.

#### Scenario: Junk is auto-sold
- **WHEN** a drop matches an auto-sell rule
- **THEN** the item SHALL NOT enter inventory and its sell value SHALL be added to the player's meseta

#### Scenario: Kept items enter inventory
- **WHEN** a drop matches a keep rule (or no auto-sell rule applies)
- **THEN** the item SHALL be added to the player's inventory

### Requirement: Meseta currency
Meseta SHALL be the currency earned from drops and auto-sold items and spent in the meta layer. Meseta from enemies SHALL arrive only as drops rolled by the drop generator (a kill MAY pay nothing); there SHALL be no separate guaranteed per-kill meseta award. The player's meseta balance SHALL persist across runs.

#### Scenario: Meseta accrues from a run
- **WHEN** a run collects meseta drops and/or auto-sells items
- **THEN** the amounts SHALL be added to the player's persistent meseta balance and reflected in the run report

#### Scenario: A kill can pay nothing
- **WHEN** an enemy dies and its drop-anything roll fails
- **THEN** the player's meseta SHALL be unchanged by that kill

### Requirement: Shop purchasing
The player SHALL be able to spend meseta in the meta layer at three per-character shop counters generated authentically (shop-generation capability): a weapon counter, an armour counter (armors, shields, units), and a tool counter (recovery consumables, grinders, technique disks). Prices SHALL come from the authentic price formulas (item-pricing capability). Each counter's stock SHALL be generated deterministically for its character from that character's level and section ID, and SHALL restock when the character's level changes.

#### Scenario: Buy consumables
- **WHEN** the player buys a consumable and has sufficient meseta
- **THEN** the system SHALL deduct the authentic price, add the consumable to the player's stock, and reject the purchase if meseta is insufficient

#### Scenario: Stocks are segregated by counter
- **WHEN** the selected character views a counter
- **THEN** the weapon counter SHALL contain only weapons, the armour counter only armors, shields, and units, and the tool counter only recovery items, grinders, and technique disks

#### Scenario: Deterministic per character and counter
- **WHEN** stock is generated twice for the same character id, level, and counter
- **THEN** the offers SHALL be identical, and the three counters SHALL draw from independent RNG streams

#### Scenario: Stock refreshes on level-up
- **WHEN** a character's level changes
- **THEN** all three of that character's counters SHALL be restocked for the new level

#### Scenario: Purchased gear enters shared inventory
- **WHEN** the player buys a gear item or technique disk from a counter
- **THEN** the meseta price SHALL be deducted from the shared balance and the item added to the shared inventory

### Requirement: Inventory
Collected items SHALL be stored in an inventory the player can view in the meta layer, and from which items can be equipped or sold.

#### Scenario: Sell an inventory item
- **WHEN** the player sells an item from inventory
- **THEN** the item SHALL be removed from inventory and its sell value added to meseta

### Requirement: Inert tool items in the economy
Inert tool items (non-mate, non-atomizer, non-grinder tools) SHALL enter the shared inventory through the loot filter like gear, valued by their authentic sell price, and SHALL be sellable but not usable.

#### Scenario: Tool item is filterable and sellable
- **WHEN** an inert tool item drops whose sell value is below the auto-sell bar
- **THEN** it SHALL be auto-sold like any other low-value item

### Requirement: Run report
When a run ends (complete or ejected), the system SHALL present a report summarizing loot collected, meseta gained, consumables used, and the run outcome.

#### Scenario: Report shown on run end
- **WHEN** a run ends by completion or ejection
- **THEN** the system SHALL display a run report listing collected items, meseta gained, consumables consumed, and whether the run completed or ejected

### Requirement: Shared account economy
Meseta, the item inventory, and the consumable supply SHALL be shared account-wide across all roster characters. Loot, sales, and purchases by any character SHALL act on the same shared balance, inventory, and supply.

#### Scenario: Meseta is shared
- **WHEN** a run by one character earns meseta and the player then selects another character
- **THEN** the second character SHALL see and spend the same meseta balance

#### Scenario: Loot is shared
- **WHEN** a run by one character keeps an item
- **THEN** the item SHALL be available in the shared inventory for any character to equip or sell
