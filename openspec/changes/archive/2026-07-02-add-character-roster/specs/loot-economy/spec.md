## MODIFIED Requirements

### Requirement: Shop purchasing
The player SHALL be able to spend meseta in the meta layer to buy consumables (healing and revive items) and grinders at flat prices, and to buy gear from a per-character shop stock. Gear stock SHALL be generated deterministically for each character, drawn from content appropriate to that character's level band, and SHALL restock when the character's level band changes.

#### Scenario: Buy consumables
- **WHEN** the player buys a consumable and has sufficient meseta
- **THEN** the system SHALL deduct the price, add the consumable to the player's stock, and reject the purchase if meseta is insufficient

#### Scenario: Gear stock matches character level
- **WHEN** the selected character views the shop
- **THEN** the offered gear SHALL come from that character's own stock, generated for that character's current level band

#### Scenario: Stock refreshes on level-band change
- **WHEN** a character's level crosses into a new level band
- **THEN** that character's gear stock SHALL be regenerated for the new band

#### Scenario: Purchased gear enters shared inventory
- **WHEN** the player buys a gear item from a character's shop stock
- **THEN** the meseta price SHALL be deducted from the shared balance and the item added to the shared inventory

## ADDED Requirements

### Requirement: Shared account economy
Meseta, the item inventory, and the consumable supply SHALL be shared account-wide across all roster characters. Loot, sales, and purchases by any character SHALL act on the same shared balance, inventory, and supply.

#### Scenario: Meseta is shared
- **WHEN** a run by one character earns meseta and the player then selects another character
- **THEN** the second character SHALL see and spend the same meseta balance

#### Scenario: Loot is shared
- **WHEN** a run by one character keeps an item
- **THEN** the item SHALL be available in the shared inventory for any character to equip or sell
