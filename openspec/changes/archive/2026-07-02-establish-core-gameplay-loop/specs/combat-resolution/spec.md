## ADDED Requirements

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
Combat SHALL run the character and the enemy on independent attack cadences determined by an attack-speed value (per weapon type for the character, per enemy type for the enemy). Enemy attacks against the character SHALL use the same hit/crit/damage pipeline in reverse.

#### Scenario: Both sides attack on their own cadence
- **WHEN** the character and an enemy are engaged
- **THEN** each SHALL take attacks at intervals set by its own attack speed, and each attack SHALL reduce the target's HP per the damage calculation until one side reaches 0 HP

#### Scenario: Enemy damage can threaten the character
- **WHEN** an enemy attack hits the character
- **THEN** the system SHALL reduce the character's HP using the same formula (enemy ATP vs. character DFP, enemy accuracy vs. character EVP, enemy crit rate) and SHALL trigger survival handling when HP is low or 0
