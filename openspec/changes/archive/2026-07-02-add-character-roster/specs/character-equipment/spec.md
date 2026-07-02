## MODIFIED Requirements

### Requirement: Character stat model
The character SHALL have the stats required by the combat formulas: ATP, DFP, ATA, EVP, LCK, MST, and HP. Base stats SHALL be derived from the character's class and level (see `character-progression`), not stored as a fixed block. The character's effective stats SHALL be the sum of derived base stats plus contributions from equipped items.

#### Scenario: Equipment contributes to effective stats
- **WHEN** an item granting a stat bonus is equipped
- **THEN** the character's effective stat used in combat SHALL include that item's contribution

#### Scenario: Base stats change only through leveling
- **WHEN** a run ends
- **THEN** the character's base stats SHALL be unchanged except as a consequence of level-ups from the XP awarded at run resolution (progression comes from gear, grind, economy, and levels)

## ADDED Requirements

### Requirement: Equipment is per-character
Each roster character SHALL have its own equipment slots. Equipping and unequipping SHALL act on the selected character only; unequipped items SHALL return to the shared inventory, from which any character may equip them.

#### Scenario: Equipment does not leak between characters
- **WHEN** the player equips an item on the selected character and then selects a different character
- **THEN** the item SHALL remain equipped on the first character and SHALL NOT appear on the second character or in the shared inventory

#### Scenario: Unequipped gear is shared
- **WHEN** a character unequips an item
- **THEN** the item SHALL be placed in the shared inventory and SHALL be equippable by any roster character
