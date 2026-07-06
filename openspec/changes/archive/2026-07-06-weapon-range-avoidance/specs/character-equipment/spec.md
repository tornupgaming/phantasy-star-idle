# character-equipment Specification (delta)

## ADDED Requirements

### Requirement: Weapon avoidance visibility
Wherever the UI presents a weapon's stats for an equip decision — the equipped-weapon display and the equipment swap/preview views — it SHALL also show the weapon kind's avoidance percentage, using the same value the run simulation uses, so the melee-vs-ranged survivability tradeoff is visible when choosing gear. A character with no weapon SHALL display the barehanded (fist) avoidance.

#### Scenario: Equipped weapon shows avoidance

- **WHEN** a character's equipment view shows the equipped weapon
- **THEN** the weapon's avoidance percentage is displayed alongside its other stats

#### Scenario: Swap preview includes avoidance

- **WHEN** the player previews equipping a different weapon kind
- **THEN** the preview shows the candidate weapon's avoidance so the change in survivability is visible before committing

#### Scenario: Barehanded avoidance shown

- **WHEN** a character has no weapon equipped
- **THEN** the display shows the fist kind's avoidance value
