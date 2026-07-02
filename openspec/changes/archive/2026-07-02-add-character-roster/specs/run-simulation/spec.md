## MODIFIED Requirements

### Requirement: Dispatching a character on a run
The system SHALL allow the player to dispatch the selected roster character into a selected area at a selected difficulty from the meta layer, starting a run that resolves without further input. There SHALL be a single global run slot shared across the whole roster.

#### Scenario: Send starts a run
- **WHEN** the player selects an area and difficulty and presses "send"
- **THEN** the system creates a run bound to the selected character's id and a snapshot of that character's derived stats, equipment, and stocked supply, assigns the run a unique id and RNG seed, and begins advancing it

#### Scenario: Only one active run at a time
- **WHEN** a run is already active
- **THEN** the system SHALL NOT start a second run for any roster character and SHALL require the active run to end (complete or eject) first

#### Scenario: Run resolves for its own character
- **WHEN** a run ends while a different character is selected
- **THEN** the run's XP and any equipment effects SHALL apply to the character that was dispatched, and loot/meseta SHALL flow to the shared economy
