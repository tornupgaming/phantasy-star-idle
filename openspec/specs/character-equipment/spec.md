# character-equipment Specification

## Purpose
Define the character stat model, equipment slots (weapon, frame, barrier, units), and weapon grinding. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Character stat model
The character SHALL have the stats required by the combat formulas: ATP, DFP, ATA, EVP, LCK, MST, and HP. Base stats SHALL be derived from the character's class and level (see `character-progression`), not stored as a fixed block. The character's effective stats SHALL be the sum of derived base stats plus contributions from equipped items.

#### Scenario: Equipment contributes to effective stats
- **WHEN** an item granting a stat bonus is equipped
- **THEN** the character's effective stat used in combat SHALL include that item's contribution

#### Scenario: Base stats change only through leveling
- **WHEN** a run ends
- **THEN** the character's base stats SHALL be unchanged except as a consequence of level-ups from the XP awarded at run resolution (progression comes from gear, grind, economy, and levels)

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

### Requirement: Equipment is per-character
Each roster character SHALL have its own equipment slots. Equipping and unequipping SHALL act on the selected character only; unequipped items SHALL return to the shared inventory, from which any character may equip them.

#### Scenario: Equipment does not leak between characters
- **WHEN** the player equips an item on the selected character and then selects a different character
- **THEN** the item SHALL remain equipped on the first character and SHALL NOT appear on the second character or in the shared inventory

#### Scenario: Unequipped gear is shared
- **WHEN** a character unequips an item
- **THEN** the item SHALL be placed in the shared inventory and SHALL be equippable by any roster character

### Requirement: Equipment stat preview
The engine SHALL provide a pure stat-preview computation returning a character's effective stats as-if a candidate item were equipped in a given slot (or as-if the slot were emptied), without mutating the character or their equipment. For units, the preview SHALL model adding the candidate unit when unit capacity remains. The preview SHALL agree with the effective stats the character would actually have after performing the corresponding equip or unequip.

#### Scenario: Preview a weapon swap
- **WHEN** a preview is computed for a weapon candidate on a character with a weapon equipped
- **THEN** the returned stats SHALL equal the effective stats the character would have with the candidate equipped in place of the current weapon, and the character's actual equipment and stats SHALL be unchanged

#### Scenario: Preview removing an item
- **WHEN** a preview is computed for emptying an occupied slot
- **THEN** the returned stats SHALL equal the effective stats the character would have with that slot empty

#### Scenario: Preview matches committed equip
- **WHEN** a previewed candidate is subsequently equipped
- **THEN** the character's effective stats SHALL equal the previewed stats

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

### Requirement: Attack-speed units affect attack cadence

Equipped units that carry an attack-speed boost (General/Battle, Devil/Battle, God/Battle, Heavenly/Battle, V101) SHALL shorten the character's attack-step durations via the frame-data interpolation. When multiple speed units are equipped, only the **highest** single boost SHALL apply — boosts SHALL NOT stack. The character's effective boost SHALL be part of the derived stats snapshotted at run dispatch, so a mid-run equipment change does not alter an in-flight run's deterministic timing.

#### Scenario: Equipped speed unit shortens attacks

- **WHEN** a character with a speed unit equipped is dispatched on a run
- **THEN** every character attack step uses the duration interpolated at that unit's boost percentage

#### Scenario: Multiple speed units do not stack

- **WHEN** a character has both a Devil/Battle (10%) and a God/Battle (20%) equipped
- **THEN** the effective attack-speed boost is 20%

#### Scenario: Boost is snapshotted at dispatch

- **WHEN** the player changes equipped units while a run is active
- **THEN** the active run's attack timing continues to use the boost captured at dispatch
