# combat-resolution Specification

## Purpose
Resolve combat exchanges using authentic PSO formulas: per-attack hit resolution, critical hits, physical damage with integer truncation, the hard 0-damage wall, configurable attack patterns, and two-clock cadences. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Per-attack hit resolution
Each attack SHALL first resolve whether it hits, using accuracy `ATAeff − (EVPeff × 0.2)` where `ATAeff = ATAtotal × attackTypeModifier × comboStepModifier`. Attack-type modifiers SHALL be Normal 1.0, Heavy 0.7, Special 0.5; combo-step modifiers SHALL be 1.0, 1.3, 1.69 for the first, second, and third attack.

#### Scenario: Miss deals no damage
- **WHEN** the accuracy roll fails
- **THEN** the attack SHALL deal 0 damage and SHALL be logged as a miss

#### Scenario: Guaranteed and impossible hits
- **WHEN** computed accuracy is at or above 100%
- **THEN** the attack SHALL always hit; **AND WHEN** computed accuracy is negative the attack SHALL always miss

### Requirement: Critical hit resolution
On a hit, the system SHALL roll a critical using a rate of `min(LCK, 100) / 5` percent for the character and `min(LCK, 100) / 2` percent for enemies. A critical SHALL multiply final damage by 1.5.

#### Scenario: Character critical
- **WHEN** an attack by the character hits and the critical roll succeeds
- **THEN** the damage SHALL be multiplied by 1.5 and logged as a critical

### Requirement: Physical damage calculation
Damage SHALL be computed as `⌊ (ATPeff − DFPeff) / 5 × 0.9 × attackModifier ⌋` where `ATPeff = [BaseATP + (Wvar × WSpread)] × (1 + SA) + EQATP + Pvar`, `EQATP = [WATP,min + (Grind × 2) + FATP + BaATP] × (Watr + 1)`, and `DFPeff = DFPbase × (1 − ZL)`. Damage SHALL be truncated (floored), never rounded up. A weapon's attribute percentage SHALL apply only to its minimum ATP.

#### Scenario: Damage is truncated
- **WHEN** a computed damage value has a fractional part (e.g. 100.92)
- **THEN** the applied damage SHALL be the floored integer (100)

#### Scenario: Weapon spread and profession variance vary per attack
- **WHEN** the character attacks
- **THEN** `Wvar` SHALL be a fresh value in the range 0..1 and `Pvar` the profession variance, both drawn from the run's seeded RNG, so repeated identical attacks produce a range of damage values

### Requirement: Damage floor as difficulty gate
When `ATPeff ≤ DFPeff`, the attack SHALL deal 0 damage (a hard wall). The system SHALL NOT apply a minimum-1 damage rule.

#### Scenario: Under-geared attacks cannot harm the enemy
- **WHEN** the character's `ATPeff` is less than or equal to the enemy's `DFPeff`
- **THEN** every attack SHALL deal 0 damage, the enemy SHALL not die, and the run SHALL eventually end by ejection when supplies run out

### Requirement: Configurable attack pattern
The character SHALL auto-attack using a player-configured, repeating sequence of attack types (Normal/Heavy). There SHALL be no live combo-timing input.

#### Scenario: Pattern drives combo steps
- **WHEN** the character engages an enemy with a configured pattern (e.g. Normal, Normal, Heavy)
- **THEN** each attack SHALL apply its attack-type modifier and its combo-step modifier in sequence, resetting to the first step after the third attack

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

### Requirement: Attack pattern balance under frame costs

The shipped default attack patterns SHALL be validated against the frame-data timings such that no pattern strictly dominates: with Heavy attacks costing their authentic longer durations, the Normal/Heavy pattern choice SHALL present a genuine sustained-DPS/accuracy tradeoff, verified by a test comparing expected sustained DPS of representative patterns (e.g. NNN, NHH, HHH) against a reference target.

#### Scenario: No pattern strictly dominates

- **WHEN** expected sustained DPS is computed for the shipped patterns against the reference target across representative hit rates
- **THEN** no single pattern is optimal at every hit rate

### Requirement: Multi-hit combo steps
A character combo step SHALL comprise one or more hits per the equipped weapon's attack profile. Each hit SHALL resolve independently through the full existing pipeline — its own accuracy roll, critical roll, and damage draws (Wvar, Pvar) from the run's seeded RNG. The combo-step accuracy modifier (1.0 / 1.3 / 1.69) SHALL apply to every hit within that step. RNG draws SHALL occur in a fixed order — targets in roster order, then hits in sequence against each target — so identical inputs reproduce identical outcomes.

#### Scenario: Hits within a step resolve independently
- **WHEN** a mechgun performs a combo step of 3 hits
- **THEN** each hit SHALL roll accuracy, critical, and damage independently, so a single step can contain any mix of hits, misses, and criticals

#### Scenario: Step accuracy modifier applies to all hits in the step
- **WHEN** a multi-hit weapon performs the third combo step
- **THEN** every hit in that step SHALL use the third step's 1.69 accuracy modifier

#### Scenario: Multi-hit resolution is deterministic
- **WHEN** the same run input is re-simulated
- **THEN** the per-hit outcomes (hit/miss, critical, damage) SHALL be identical across re-simulations
