## MODIFIED Requirements

### Requirement: Shop purchasing
The player SHALL be able to spend meseta in the meta layer to buy consumables (healing and revive items) and grinders at flat prices, and to buy gear from two per-character shop stocks: a weapon stock offering weapons, and an armour stock offering frames, barriers, and units. Each stock SHALL be generated deterministically for its character and shop kind, drawn from content appropriate to that character's level band, and SHALL restock independently when the character's level band changes.

#### Scenario: Buy consumables
- **WHEN** the player buys a consumable and has sufficient meseta
- **THEN** the system SHALL deduct the price, add the consumable to the player's stock, and reject the purchase if meseta is insufficient

#### Scenario: Stocks are segregated by kind
- **WHEN** the selected character views the weapon shop or the armour shop
- **THEN** the weapon stock SHALL contain only weapons and the armour stock only frames, barriers, and units, each generated for that character's current level band

#### Scenario: Deterministic per character and kind
- **WHEN** two stocks are generated for the same character, level band, and restock counter
- **THEN** the same shop kind SHALL yield identical offers, and the weapon and armour stocks SHALL be drawn from independent RNG streams

#### Scenario: Stock refreshes on level-band change
- **WHEN** a character's level crosses into a new level band
- **THEN** both of that character's shop stocks SHALL be regenerated for the new band

#### Scenario: Purchased gear enters shared inventory
- **WHEN** the player buys a gear item from either shop stock
- **THEN** the meseta price SHALL be deducted from the shared balance and the item added to the shared inventory
