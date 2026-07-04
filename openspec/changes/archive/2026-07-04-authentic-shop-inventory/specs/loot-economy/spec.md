# loot-economy Delta

## MODIFIED Requirements

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
