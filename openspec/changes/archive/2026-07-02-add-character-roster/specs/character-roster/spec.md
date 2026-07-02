## ADDED Requirements

### Requirement: Character roster
The system SHALL maintain a roster of up to 4 characters. Exactly one character SHALL be selected at any time; the selected character is the one that equips gear, shops, configures runs, and is dispatched. The roster and each character's state SHALL persist in the save.

#### Scenario: Create a character
- **WHEN** the player creates a character and the roster is below the cap
- **THEN** the system SHALL add a new level-1 character with the chosen name, class, and section ID, with empty equipment

#### Scenario: Roster cap enforced
- **WHEN** the player attempts to create a character while the roster already has 4 characters
- **THEN** the system SHALL reject the creation

#### Scenario: Select a character
- **WHEN** the player selects a roster character and no run is active
- **THEN** that character SHALL become the selected character for equipment, shop, run configuration, and dispatch

#### Scenario: Selection locked during a run
- **WHEN** a run is active
- **THEN** the system SHALL NOT change the selected character until the run ends

### Requirement: Character creation choices
Character creation SHALL require a name, one of the 12 PSO Blue Burst classes (HUmar, HUnewearl, HUcast, HUcaseal, RAmar, RAmarl, RAcast, RAcaseal, FOmar, FOmarl, FOnewm, FOnewearl), and a section ID (one of the 10: Viridia, Greenill, Skyly, Bluefull, Purplenum, Pinkal, Redria, Oran, Yellowboze, Whitill).

#### Scenario: Section ID defaults from name
- **WHEN** the player enters a character name during creation
- **THEN** the system SHALL derive and display the default section ID as the sum of the name's character code units modulo 10, mapped to the canonical section ID order

#### Scenario: Section ID override
- **WHEN** the player explicitly chooses a section ID different from the derived default
- **THEN** the system SHALL use the chosen section ID for the created character

#### Scenario: Class and section ID are immutable
- **WHEN** a character has been created
- **THEN** the system SHALL provide no operation that changes that character's class or section ID

### Requirement: Character deletion
The player SHALL be able to delete a roster character, except the last remaining one. Deletion SHALL return the character's equipped items to the shared inventory before removal.

#### Scenario: Deletion unequips into shared inventory
- **WHEN** the player deletes a character that has items equipped
- **THEN** those items SHALL be moved to the shared inventory and the character removed from the roster

#### Scenario: Cannot delete the last character
- **WHEN** the roster contains exactly one character
- **THEN** the system SHALL reject deletion of that character

#### Scenario: Cannot delete a running character
- **WHEN** the character to delete is bound to the active run
- **THEN** the system SHALL reject the deletion until the run ends

### Requirement: Legacy save migration
Loading a save from the previous save version SHALL migrate the single legacy character into roster slot 1 rather than discarding the save.

#### Scenario: Legacy character migrated
- **WHEN** a save with the previous version is loaded
- **THEN** the system SHALL create a roster containing the legacy character with class HUmar, a section ID derived from its name, a level whose derived base stats best match (without falling below) the legacy flat base stats, its existing equipment, and the existing shared meseta, inventory, and supply
