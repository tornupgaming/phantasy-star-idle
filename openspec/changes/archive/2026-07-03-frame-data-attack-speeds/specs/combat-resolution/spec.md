# combat-resolution Specification (delta)

## MODIFIED Requirements

### Requirement: Two-clock combat exchange

Combat SHALL run the character and the enemy on independent attack cadences. The enemy cadence SHALL be a flat interval per enemy type. The character cadence SHALL be a combo-burst rhythm of three attacks timed by authentic frame data: each attack's duration SHALL be resolved from the character's animation rig, the equipped weapon's kind (fist when barehanded), the attack's tier (Normal/Heavy/Special, with Special using Heavy timing), and the character's attack-speed boost. An attack that chains into a further combo step SHALL bill its **Combo** duration; the attack that ends the burst (third step, or a kill that resets the combo) SHALL bill its **Full** duration, which includes the animation's recovery tail. A separate, hand-tuned repositioning pause SHALL additionally follow the end of a burst (representing movement between targets, distinct from animation recovery). Heavy and Special attacks SHALL take longer than Normal attacks per the frame data. Enemy attacks against the character SHALL use the same hit/crit/damage pipeline in reverse.

#### Scenario: Both sides attack on their own cadence

- **WHEN** the character and an enemy are engaged
- **THEN** the enemy SHALL attack at its type's flat interval, the character SHALL attack in three-hit bursts timed by rig/kind/tier frame data, and each attack SHALL reduce the target's HP per the damage calculation until one side reaches 0 HP

#### Scenario: Chained steps bill combo duration, burst end bills full duration

- **WHEN** the character performs the first or second attack of a combo and the combo continues
- **THEN** the next attack SHALL be scheduled after that step's Combo duration; and when the burst ends (third attack, or combo reset) the elapsed time SHALL be that step's Full duration plus the repositioning pause

#### Scenario: Kill mid-burst triggers recovery before retargeting

- **WHEN** the character's attack kills its target before the combo completes
- **THEN** the combo SHALL reset and the next attack (against the next living enemy) SHALL be scheduled after that step's Full duration plus the repositioning pause, representing the completed swing and movement to the new target

#### Scenario: Heavy attacks cost more time

- **WHEN** a first- or second-step attack is performed as Heavy instead of Normal with the same rig, weapon, and speed boost
- **THEN** the Heavy step's duration SHALL be greater than or equal to the Normal step's duration, per the frame data (the third hit's full recovery is exempt — on some weapon kinds the measured Heavy ending recovery is a few frames shorter than Normal's)

#### Scenario: Speed boost shortens the burst

- **WHEN** the character has a nonzero attack-speed boost
- **THEN** every step duration SHALL be the interpolated value between the 0% and +40% anchors for that cell, and a full burst SHALL take less time than at 0% boost

#### Scenario: Misses keep burst timing

- **WHEN** a character attack in a burst misses
- **THEN** the combo SHALL still advance and the timing of the remaining attacks and recovery SHALL be unchanged by the miss

#### Scenario: Enemy damage can threaten the character

- **WHEN** an enemy attack hits the character
- **THEN** the system SHALL reduce the character's HP using the same formula (enemy ATP vs. character DFP, enemy accuracy vs. character EVP, enemy crit rate) and SHALL trigger survival handling when HP is low or 0

## ADDED Requirements

### Requirement: Attack pattern balance under frame costs

The shipped default attack patterns SHALL be validated against the frame-data timings such that no pattern strictly dominates: with Heavy attacks costing their authentic longer durations, the Normal/Heavy pattern choice SHALL present a genuine sustained-DPS/accuracy tradeoff, verified by a test comparing expected sustained DPS of representative patterns (e.g. NNN, NHH, HHH) against a reference target.

#### Scenario: No pattern strictly dominates

- **WHEN** expected sustained DPS is computed for the shipped patterns against the reference target across representative hit rates
- **THEN** no single pattern is optimal at every hit rate
