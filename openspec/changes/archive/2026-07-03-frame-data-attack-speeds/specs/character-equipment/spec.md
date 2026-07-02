# character-equipment Specification (delta)

## ADDED Requirements

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
