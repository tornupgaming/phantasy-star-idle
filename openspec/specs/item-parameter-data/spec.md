# item-parameter-data Specification

## Purpose
Ship the authentic PSO Blue Burst item parameter table (stats, requirements, grind limits, rarity, usability, sale data) as a condensed generated dataset with a reproducible extraction pipeline from the newserv clone, exposed to the engine through a typed loader.

## Requirements

### Requirement: Condensed authentic item dataset

The engine SHALL ship a generated dataset (`src/engine/data/item-table.json`) containing every item from the newserv BB item parameter table (`item-parameter-table-bb-v4.json`) joined with its display name (`names-v4.json`), keyed by 6-hex-digit item code and segregated by kind (weapons, frames, barriers, units, mags, tools). The dataset MUST be standard JSON (no comments or hex literals) and MUST preserve, for consumed kinds: weapon ATP min/max, ATA, max grind, ATP/ATA/MST requirements, special id, class-usability bitmask, sale divisor, weapon group, and authentic animation category (`WeaponKind`); frame/barrier DFP/EVP with ranges, elemental resists, and required level; unit stat index, amount, and modifier; and a resolved star value for every entry.

#### Scenario: Stats match the Blue Burst source

- **WHEN** any dataset entry is compared with the corresponding entry in the newserv table
- **THEN** every ported numeric field is identical to the source value (hex decoded to decimal), with star values resolved via `StarValues[ID − StarValueBaseIndex]`

#### Scenario: Known reference values

- **WHEN** the dataset is loaded
- **THEN** spot-check entries match the source (e.g. Saber `000100` has the source ATPMin/ATPMax/ATA/MaxGrind; Frame `010100` has the source DFP/EVP; and the dataset contains exactly the source's entry count)

#### Scenario: Names are joined

- **WHEN** an item code exists in both source files
- **THEN** its dataset entry carries the display name from `names-v4.json`

### Requirement: Reproducible extraction pipeline

A build-time script (`npm run extract:item-table`) SHALL regenerate the dataset from a local newserv clone. It MUST parse newserv's JSON dialect (comments, hex literals), MUST emit deterministic output (sorted keys, fixed field order) such that regeneration against the same clone is byte-identical, and MUST fail without writing output if the source shape drifts from expectations.

#### Scenario: Regeneration is deterministic

- **WHEN** the extraction script is run twice against the same newserv clone
- **THEN** the output file is byte-identical

#### Scenario: Upstream format drift is detected

- **WHEN** the newserv table is missing an expected top-level section, an expected per-kind field, or the expected entry count
- **THEN** the script exits with an error and writes no output

### Requirement: Typed loader over the dataset

The engine SHALL expose the dataset only through a typed loader (`src/engine/data/item-table.ts`) providing per-kind definition types and code-based lookups, a stars→rarity bucket mapping (0–3 common, 4–8 uncommon, ≥9 rare) that preserves the raw star value, and an adapter producing a `GearTemplate` from an item code for weapons, frames, barriers, and units. Mag and tool entries are extracted but SHALL NOT be consumed by the engine.

#### Scenario: Definition lookup by code

- **WHEN** a known weapon code is requested
- **THEN** the loader returns a typed definition with authentic stats, requirements, name, group, stars, and derived rarity

#### Scenario: Template adapter bridges to the item model

- **WHEN** a gear template is built from an item code
- **THEN** it is a valid `GearTemplate` with `minAtp` = ATP min, `spread` = ATP max − ATP min, rarity from the star bucket, sell value derived from the sale divisor, and equip requirements carried over

### Requirement: Weapon kind speed mapping

Every weapon definition SHALL carry its authentic animation category (`WeaponKind`, 19 values: fist, saber, sword, dagger, partisan, slicer, handgun, rifle, mechgun, shot, cane, rod, wand, claw, double-saber, twin-sword, katana, launcher, card). The pacing module SHALL resolve every weapon kind directly to authentic frame-data timings (attack-frame-data capability) keyed by the character's animation rig, the weapon kind, and the attack tier. The former five-archetype lookup table (the designated replacement seam) SHALL be removed.

#### Scenario: Every weapon kind resolves to frame-data timing

- **WHEN** any weapon definition in the dataset is queried for its combo-step timing
- **THEN** its `WeaponKind` resolves through the frame-data accessor (with rig fallback) to authentic step durations, for all 19 kinds

### Requirement: Attack-speed unit stat exposure

The condensed item dataset SHALL expose the attack-speed percentage of speed units (source stat 19: General/Battle 5, Devil/Battle 10, God/Battle 20, Heavenly/Battle 40) as a typed field on unit definitions. V101, whose speed effect is hardcoded in the original client rather than data-driven, SHALL be normalized to a 40% attack-speed boost at load time, with the special-casing documented at the normalization site.

#### Scenario: Battle units carry their boost

- **WHEN** a unit definition with source stat 19 is loaded
- **THEN** its typed definition exposes the stat amount as an attack-speed boost percentage

#### Scenario: V101 is normalized

- **WHEN** the V101 unit definition is loaded
- **THEN** its typed definition exposes a 40% attack-speed boost despite its source entry using a different stat
