# drop-table-data Specification

## Purpose
Reproducibly extract resolved common-drop tables and sliced rare-drop specs from the newserv clone into checked-in engine datasets, including the per-enemy rt-index mapping (mirrors the item-parameter-data pipeline pattern).

## Requirements

### Requirement: Resolved common-drop dataset

The engine SHALL ship a checked-in, generated dataset of authentic Blue Burst common-drop tables derived from newserv's `system/tables/common-table-v3-v4.json`, with the file's inheritance rules (previous section ID → previous difficulty → Normal game mode) fully resolved at extraction time. The dataset SHALL cover Episode 1, Normal game mode, the difficulties Normal, Hard, and Ultimate, and all 10 section IDs, and SHALL carry per scenario: the weapon type/subtype-base/subtype-area-length tables, grind table, armor type table + bias + slot-count table, enemy rt-index meseta ranges / drop probabilities / item classes, box meseta ranges, bonus value/spec/type tables, special mult and percent tables, unit max-stars table, tool-class table, and box item-class table. Technique tables SHALL NOT be carried.

#### Scenario: Inheritance is resolved offline

- **WHEN** the dataset is generated for a scenario whose source entry omits keys (e.g. Ep1 Normal-mode Hard Bluefull)
- **THEN** the emitted entry SHALL contain the complete table set, with omitted keys filled from the inheritance chain exactly as newserv resolves them, and the engine SHALL perform no inheritance resolution at runtime

#### Scenario: Known reference values

- **WHEN** the generated dataset is compared against hand-verified cells from the newserv source
- **THEN** sampled values (e.g. a `BaseWeaponTypeProbTable` row for a fully-specified scenario) SHALL match the source exactly

### Requirement: Sliced rare-drop dataset

The engine SHALL ship a checked-in, generated dataset of rare-drop specs derived from newserv's `system/tables/rare-table-v4.json`, sliced to Episode 1, Normal game mode, the difficulties Normal, Hard, and Ultimate, and all 10 section IDs. Each spec SHALL carry a normalized drop probability (converted from the source's 2^32-denominator integers or fraction strings) and the resolved item code. Specs whose item code does not resolve to a weapon, frame, barrier, or unit in the item-parameter dataset SHALL be excluded at extraction time.

#### Scenario: Probability normalization

- **WHEN** a source spec expresses its probability as a fraction string (e.g. "3/32") or a 32-bit integer
- **THEN** the emitted spec SHALL carry the equivalent numeric probability such that both forms of the same odds produce the same value

#### Scenario: Non-gear rares are excluded

- **WHEN** a source spec's item code resolves to a tool, mag, or meseta
- **THEN** the spec SHALL NOT appear in the emitted dataset

### Requirement: Enemy rt-index and key mapping validation

The extraction SHALL map each wired enemy's `statsType` to its newserv `EnemyType`, emit the enemy's `rt_index`, and validate the mapping: every enemy referenced by a wired area SHALL resolve to an rt-index row, and every retained rare-table `Where` key SHALL match a wired enemy type or a wired box area. A mapping failure SHALL fail the extraction with a diagnostic rather than emit a partial dataset.

#### Scenario: Unmapped enemy fails the build

- **WHEN** a wired enemy's `statsType` cannot be mapped to an rt-index
- **THEN** the extraction script SHALL exit with an error naming the enemy, and no dataset SHALL be written

### Requirement: Tech-disk exclusion baked into tool tables

The extracted tool-class tables SHALL have the weights of all technique-disk tool classes set to zero, so that tech disks can never be selected by the drop generator.

#### Scenario: Tech disks cannot drop

- **WHEN** the tool-class table for any scenario and area is sampled exhaustively
- **THEN** no technique-disk class SHALL have a nonzero weight

### Requirement: Reproducible extraction pipeline

The datasets SHALL be regenerable from the newserv clone via npm scripts (following the existing `extract:*` pattern), producing byte-identical output for unchanged inputs. The scripts SHALL fail loudly if the upstream file shapes drift from the expected format.

#### Scenario: Regeneration is deterministic

- **WHEN** the extraction scripts run twice against the same newserv checkout
- **THEN** the emitted dataset files SHALL be byte-identical

#### Scenario: Upstream format drift is detected

- **WHEN** an expected table key or shape is missing from the newserv source
- **THEN** the script SHALL exit with a diagnostic error instead of emitting a dataset
