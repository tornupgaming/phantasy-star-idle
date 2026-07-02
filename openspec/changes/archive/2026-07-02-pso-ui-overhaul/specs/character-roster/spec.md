## MODIFIED Requirements

### Requirement: Character roster
The system SHALL maintain an unbounded roster of characters. Exactly one character SHALL be selected at any time; the selected character is the one that equips gear, shops, configures runs, and is dispatched. The roster and each character's state SHALL persist in the save.

#### Scenario: Create a character
- **WHEN** the player creates a character
- **THEN** the system SHALL add a new level-1 character with the chosen name, class, and section ID, with empty equipment

#### Scenario: No roster size limit
- **WHEN** the player creates a character while the roster already contains 4 or more characters
- **THEN** the system SHALL accept the creation

#### Scenario: Select a character
- **WHEN** the player selects a roster character and no run is active
- **THEN** that character SHALL become the selected character for equipment, shop, run configuration, and dispatch

#### Scenario: Selection locked during a run
- **WHEN** a run is active
- **THEN** the system SHALL NOT change the selected character until the run ends
