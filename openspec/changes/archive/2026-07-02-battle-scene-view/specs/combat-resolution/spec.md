# combat-resolution Specification (delta)

## MODIFIED Requirements

### Requirement: Two-clock combat exchange
Combat SHALL run the character and the enemy on independent attack cadences. The enemy cadence SHALL be a flat interval per enemy type. The character cadence SHALL be a combo-burst rhythm: three attacks separated by a short per-weapon-type combo-step interval, followed by a fixed recovery pause before the next burst begins (representing the movement/repositioning time of the source games). Enemy attacks against the character SHALL use the same hit/crit/damage pipeline in reverse.

#### Scenario: Both sides attack on their own cadence
- **WHEN** the character and an enemy are engaged
- **THEN** the enemy SHALL attack at its type's flat interval, the character SHALL attack in three-hit bursts at the weapon's combo-step interval with the recovery pause after each third attack, and each attack SHALL reduce the target's HP per the damage calculation until one side reaches 0 HP

#### Scenario: Recovery pause follows a completed burst
- **WHEN** the character lands or whiffs the third attack of a combo
- **THEN** the next character attack SHALL be scheduled after the fixed recovery pause (in addition to normal step timing), and the combo SHALL restart at step one

#### Scenario: Kill mid-burst triggers recovery before retargeting
- **WHEN** the character's attack kills its target before the combo completes
- **THEN** the combo SHALL reset and the next attack (against the next living enemy) SHALL be scheduled after the fixed recovery pause, representing repositioning to the new target

#### Scenario: Misses keep burst timing
- **WHEN** a character attack in a burst misses
- **THEN** the combo SHALL still advance and the timing of the remaining attacks and recovery SHALL be unchanged by the miss

#### Scenario: Enemy damage can threaten the character
- **WHEN** an enemy attack hits the character
- **THEN** the system SHALL reduce the character's HP using the same formula (enemy ATP vs. character DFP, enemy accuracy vs. character EVP, enemy crit rate) and SHALL trigger survival handling when HP is low or 0
