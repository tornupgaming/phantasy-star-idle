# character-progression — delta for apply-bb-stat-transform

## MODIFIED Requirements

### Requirement: Class-derived base stats
Each character's base stats SHALL be derived from its class and level by applying the authentic PSO Blue Burst client stat transform to the ported level table: the raw table accumulation (class base stats plus the sum of per-level growth deltas up to the character's level, clamped to the class's raw stat caps) followed by the client transform:

- ATP SHALL be the raw value plus a role bonus: +10 for hunters, +5 for rangers, +3 for forces (applied to caps as well).
- HP SHALL be `floor(roleMult × (rawHP + level − 1))` with roleMult 2.0 for hunters, 1.85 for rangers, 1.45 for forces (applied to caps as the level-200 form).
- ATA SHALL be computed in tenths as a per-class constant plus the raw base ATA (interpreted as tenths) plus accumulated tenth deltas, clamped to the class ATA cap plus the same constant; the display value is the tenths value divided by 10 and truncated.
- DFP, EVP, MST, and LCK SHALL be the raw table values with no transform.

Derived stats SHALL be deterministic — the same class and level always produce the same base stats — and SHALL use integer arithmetic (no floating-point accumulation).

#### Scenario: Level 1 stats match authentic BB values
- **WHEN** a character is created with a given class
- **THEN** its derived base stats SHALL equal the authentic BB client level-1 values for that class (e.g., HUmar: HP 40, ATP 45, ATA 68, DFP 17, EVP 45, MST 29)

#### Scenario: Derived stats match published growth tables
- **WHEN** stats are derived for any of the 12 classes at sampled levels (1, 5, 10, 50, 100, 150, 200)
- **THEN** HP, ATP, ATA, DFP, EVP, MST, and TP SHALL equal the published Ephinea growth-table values for that class and level

#### Scenario: Stats clamped at transformed class caps
- **WHEN** accumulated growth would push a stat above the class's maximum for that stat
- **THEN** the derived stat SHALL be clamped such that the effective cap matches the authentic BB displayed maximum (e.g., HUmar ATP cap 1397, ATA cap 200)

## ADDED Requirements

### Requirement: Derived TP stat
Each character SHALL have a derived TP stat: `MST + level − 1` for hunters and rangers, `floor((MST + level − 1) × 1.5)` for forces, and 0 for android classes. TP SHALL be derived (never persisted) and deterministic for a given class and level.

#### Scenario: Force TP multiplier
- **WHEN** TP is derived for a level 1 FOnewearl (MST 58)
- **THEN** TP SHALL be 87

#### Scenario: Android TP is zero
- **WHEN** TP is derived for an android class (HUcast, HUcaseal, RAcast, RAcaseal) at any level
- **THEN** TP SHALL be 0
