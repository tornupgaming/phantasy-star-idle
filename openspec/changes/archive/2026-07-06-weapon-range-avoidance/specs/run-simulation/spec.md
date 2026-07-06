# run-simulation Specification (delta)

## MODIFIED Requirements

### Requirement: Battle log
The system SHALL produce a human-readable, scrollable log of run events (attacks, hits/misses, crits, sidesteps, kills, dynamic enemy spawns, box opens, loot, heals, ejection) that the player MAY read or ignore. Each event SHALL additionally carry structured, machine-readable data sufficient to reconstruct the battle scene state (initial room composition, dynamically appended enemies, per-enemy HP, character HP) without parsing the human-readable text.

#### Scenario: Log records combat, dynamic spawns, and loot events
- **WHEN** an enemy dynamically spawns, an attack lands, an attack is sidestepped, an enemy dies, a box opens, or loot is collected
- **THEN** the system SHALL append a corresponding entry to the run's battle log

#### Scenario: Room events carry the initial enemy roster
- **WHEN** the character enters a room
- **THEN** the room event SHALL include the room index, total room count, and the initial list of enemies with their names and max HP, in a fixed order that identifies each initial enemy by roster index

#### Scenario: Spawn events append enemies to the roster
- **WHEN** an enemy appears after room entry
- **THEN** the spawn event SHALL include the appended enemy's roster index, enemy id, name, and max HP, and that index SHALL identify the enemy for subsequent attack and kill events in that room

#### Scenario: Attack events identify actor, target, and outcome
- **WHEN** an attack is resolved
- **THEN** the attack event SHALL include the actor (character, or which enemy by index), the target (by index when the character attacks), whether it hit, whether it was a critical, the damage dealt, and the target's HP after the attack — unambiguous even when a room contains multiple enemies with the same name

#### Scenario: Sidestep events identify the avoided attacker
- **WHEN** an incoming enemy attack is sidestepped
- **THEN** the log SHALL record a `sidestep` event, distinct from a missed attack event, whose structured payload identifies the attacking enemy by roster index, and no health value SHALL change as a result of the event

#### Scenario: Kill, heal, and revive events carry resulting state
- **WHEN** an enemy is defeated, or the character is auto-healed or revived
- **THEN** the kill event SHALL identify the defeated enemy by index and its XP award, and heal/revive events SHALL include the character's HP after the event

#### Scenario: Structured payloads preserve determinism and persistence shape
- **WHEN** the same run input is re-simulated
- **THEN** the structured payloads SHALL be identical across re-simulations, and the persisted save shape SHALL be unchanged (events remain derived state, recomputed from the stored run input)
