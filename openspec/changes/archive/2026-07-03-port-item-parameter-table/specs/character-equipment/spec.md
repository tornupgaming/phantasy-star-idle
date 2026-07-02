# character-equipment (delta)

## ADDED Requirements

### Requirement: Equip requirements

Items MAY carry equip requirements: minimum base ATP/ATA/MST (weapons), minimum level (frames/barriers), and a class-usability bitmask mapped onto the 12-class roster. `equip` SHALL reject an item whose requirements the character does not meet, validating stat requirements against the character's **base** stats (not equipment-boosted stats, matching authentic PSO behavior) and returning the same error-result shape as existing slot validation. Items without requirements — including all current curated gear — SHALL equip exactly as before.

#### Scenario: Stat requirement blocks equip

- **WHEN** a character whose base ATP is below a weapon's ATP requirement attempts to equip it
- **THEN** the equip is rejected with an error result and equipment is unchanged

#### Scenario: Class restriction blocks equip

- **WHEN** a character of a class not present in an item's usability bitmask attempts to equip it
- **THEN** the equip is rejected with an error result

#### Scenario: Requirements check base stats

- **WHEN** a character meets a weapon's ATP requirement only through equipment bonuses, not base stats
- **THEN** the equip is rejected

#### Scenario: Requirement-free gear is unaffected

- **WHEN** a character equips an item that carries no requirements
- **THEN** the equip succeeds under the same rules as before this change
