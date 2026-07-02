## ADDED Requirements

### Requirement: Monest broods spawn Mothmants dynamically
When authentic spawn data pairs Mothmants with a Monest in a generated room, the system SHALL treat those Mothmants as a Monest brood quota rather than as ordinary room enemies or standalone generated rooms.

#### Scenario: Brood Mothmants do not become standalone rooms
- **WHEN** stage generation processes a spawn wave containing one Monest and one or more Mothmants assigned to that Monest brood
- **THEN** the generated stage SHALL include the Monest encounter as a room and SHALL NOT create later Mothmant-only rooms from that brood quota

#### Scenario: Initial brood burst protects the Monest
- **WHEN** the character enters a generated Monest brood room with at least two brood Mothmants available
- **THEN** the simulation SHALL spawn 2–5 Mothmants in quick succession at room start, clamped by the brood quota, and SHALL place the Monest after a small deterministic number of those Mothmants in the room's target order

#### Scenario: Brood continues while Monest lives
- **WHEN** the Monest remains alive after the initial brood burst and brood quota remains
- **THEN** the simulation SHALL append one additional Mothmant to the room every 5 seconds of game time until the Monest dies or the brood quota is exhausted

#### Scenario: Killing Monest stops future brood spawns
- **WHEN** the Monest in a brood room is defeated
- **THEN** the simulation SHALL stop spawning additional Mothmants from that brood, and already-spawned Mothmants SHALL remain living enemies until defeated

#### Scenario: Spawned Mothmants are normal enemies
- **WHEN** a spawned Mothmant attacks, is attacked, is defeated, or drops loot
- **THEN** it SHALL use the same combat, XP, meseta, drop, and kill-event rules as a Mothmant that was present at room entry

## MODIFIED Requirements

### Requirement: Battle log
The system SHALL produce a human-readable, scrollable log of run events (attacks, hits/misses, crits, kills, dynamic enemy spawns, box opens, loot, heals, ejection) that the player MAY read or ignore. Each event SHALL additionally carry structured, machine-readable data sufficient to reconstruct the battle scene state (initial room composition, dynamically appended enemies, per-enemy HP, character HP) without parsing the human-readable text.

#### Scenario: Log records combat, dynamic spawns, and loot events
- **WHEN** an enemy dynamically spawns, an attack lands, an enemy dies, a box opens, or loot is collected
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

#### Scenario: Kill, heal, and revive events carry resulting state
- **WHEN** an enemy is defeated, or the character is auto-healed or revived
- **THEN** the kill event SHALL identify the defeated enemy by index and its XP award, and heal/revive events SHALL include the character's HP after the event

#### Scenario: Structured payloads preserve determinism and persistence shape
- **WHEN** the same run input is re-simulated
- **THEN** the structured payloads SHALL be identical across re-simulations, and the persisted save shape SHALL be unchanged (events remain derived state, recomputed from the stored run input)
