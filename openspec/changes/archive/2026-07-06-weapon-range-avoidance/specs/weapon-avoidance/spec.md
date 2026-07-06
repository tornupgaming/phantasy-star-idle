# weapon-avoidance Specification (delta)

## ADDED Requirements

### Requirement: Per-weapon-kind avoidance table
The engine SHALL define an avoidance percentage for every authentic weapon kind (`WeaponKindName`), representing the chance the virtual player sidesteps an incoming enemy attack while wielding that kind. Values SHALL be tiered by the kind's authentic PSO effective range: point-blank melee kinds (fist, saber, dagger, claw, sword, double-saber, twin-sword, katana) and force melee kinds (cane, rod, wand) lowest; partisan slightly above point-blank melee; close-range guns (mechgun, shot) above melee; thrown/mid kinds (slicer, card) above close-range guns; handgun and launcher above those; rifle highest. A lookup helper SHALL resolve a numeric weapon kind to its avoidance and SHALL treat a barehanded character (no weapon) as the fist kind.

#### Scenario: Every kind resolves

- **WHEN** the avoidance of each of the 19 weapon kinds is looked up
- **THEN** each returns a percentage in (0, 100), with no kind missing from the table

#### Scenario: Range ordering holds

- **WHEN** the table's values are compared
- **THEN** rifle > handgun ≥ launcher > slicer > mechgun ≥ shot > partisan > saber, and force melee kinds equal point-blank melee

#### Scenario: Barehanded uses the fist row

- **WHEN** avoidance is resolved for a character with no weapon equipped
- **THEN** the fist kind's avoidance is returned

### Requirement: Sidestep pre-roll on incoming enemy attacks
Before an enemy attack is resolved through the authentic combat pipeline, the run SHALL draw once from the run's seeded RNG against the equipped weapon's avoidance percentage (snapshotted at dispatch). On success the attack SHALL be avoided outright — no hit roll, no crit roll, no damage, no heal/revive processing — and the enemy's next-attack clock SHALL advance exactly as if the attack had resolved. On failure the authentic pipeline (accuracy, hit, crit, damage) SHALL run unchanged. The pre-roll SHALL NOT modify any authentic combat formula, character-attack resolution, or enemy statistics.

#### Scenario: Sidestep avoids the attack entirely

- **WHEN** the sidestep pre-roll succeeds for an incoming enemy attack
- **THEN** the character's HP is unchanged, no accuracy/hit/crit/damage draws occur for that attack, and the enemy's next attack is scheduled at its normal interval

#### Scenario: Failed sidestep changes nothing downstream

- **WHEN** the sidestep pre-roll fails
- **THEN** the attack resolves through the existing authentic pipeline with outcomes identical in form to pre-change behavior (miss, hit, crit, damage, survival processing)

#### Scenario: Character attacks are unaffected

- **WHEN** the character attacks an enemy
- **THEN** no sidestep pre-roll is involved (enemy-side avoidance is out of scope)

#### Scenario: Deterministic replay

- **WHEN** the same run input (runId, seed) is re-simulated under the same version
- **THEN** the same attacks are sidestepped and the battle log is identical
