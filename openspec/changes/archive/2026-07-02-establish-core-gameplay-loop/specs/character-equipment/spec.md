## ADDED Requirements

### Requirement: Character stat model
The character SHALL have the stats required by the combat formulas: ATP, DFP, ATA, EVP, LCK, MST, and HP. The character's effective stats SHALL be the sum of base stats plus contributions from equipped items.

#### Scenario: Equipment contributes to effective stats
- **WHEN** an item granting a stat bonus is equipped
- **THEN** the character's effective stat used in combat SHALL include that item's contribution

#### Scenario: Base stats persist across runs
- **WHEN** a run ends
- **THEN** the character's base stats SHALL be unchanged by the run itself (progression comes from gear, grind, and economy, not from the run outcome)

### Requirement: Equipment slots
The character SHALL have equipment slots for a weapon, a frame (body armor contributing DFP/EVP), a barrier (shield), and units (stat modules). Only one item MAY occupy a given slot; units are limited by the frame's available unit slots.

#### Scenario: Equipping a weapon changes attack stats
- **WHEN** the player equips a weapon
- **THEN** the weapon's `WATP,min`, `WSpread`, `Watr`, ATA, and attack speed SHALL be used by combat resolution for the next run

#### Scenario: Units limited by frame slots
- **WHEN** the player attempts to equip more units than the frame provides slots for
- **THEN** the system SHALL reject the excess unit(s)

### Requirement: Weapon grinding
A weapon SHALL have a grind value from 0 up to a per-weapon maximum. Applying a grinder consumable SHALL increase the grind by 1 up to that maximum, and grind SHALL feed the `Grind × 2` term of the damage formula.

#### Scenario: Grinding raises weapon power
- **WHEN** the player applies a grinder to a weapon below its maximum grind
- **THEN** the grind value SHALL increase by 1, one grinder SHALL be consumed, and the weapon's `EQATP` contribution SHALL increase accordingly

#### Scenario: Cannot grind past maximum
- **WHEN** the player applies a grinder to a weapon already at its maximum grind
- **THEN** the system SHALL reject the action and SHALL NOT consume a grinder
