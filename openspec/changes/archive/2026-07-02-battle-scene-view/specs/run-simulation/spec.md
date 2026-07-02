# run-simulation Specification (delta)

## MODIFIED Requirements

### Requirement: Battle log
The system SHALL produce a human-readable, scrollable log of run events (attacks, hits/misses, crits, kills, box opens, loot, heals, ejection) that the player MAY read or ignore. Each event SHALL additionally carry structured, machine-readable data sufficient to reconstruct the battle scene state (room composition, per-enemy HP, character HP) without parsing the human-readable text.

#### Scenario: Log records combat and loot events
- **WHEN** an attack lands, an enemy dies, a box opens, or loot is collected
- **THEN** the system SHALL append a corresponding entry to the run's battle log

#### Scenario: Room events carry the enemy roster
- **WHEN** the character enters a room
- **THEN** the room event SHALL include the room index, total room count, and the list of enemies with their names and max HP, in a fixed order that identifies each enemy for the remainder of the room

#### Scenario: Attack events identify actor, target, and outcome
- **WHEN** an attack is resolved
- **THEN** the attack event SHALL include the actor (character, or which enemy by index), the target (by index when the character attacks), whether it hit, whether it was a critical, the damage dealt, and the target's HP after the attack — unambiguous even when a room contains multiple enemies with the same name

#### Scenario: Kill, heal, and revive events carry resulting state
- **WHEN** an enemy is defeated, or the character is auto-healed or revived
- **THEN** the kill event SHALL identify the defeated enemy by index and its XP award, and heal/revive events SHALL include the character's HP after the event

#### Scenario: Structured payloads preserve determinism and persistence shape
- **WHEN** the same run input is re-simulated
- **THEN** the structured payloads SHALL be identical across re-simulations, and the persisted save shape SHALL be unchanged (events remain derived state, recomputed from the stored run input)
