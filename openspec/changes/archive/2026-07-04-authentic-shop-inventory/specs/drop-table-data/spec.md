# drop-table-data Delta

## MODIFIED Requirements

### Requirement: Resolved common-drop dataset

The engine SHALL ship a checked-in, generated dataset of authentic Blue Burst common-drop tables derived from newserv's `system/tables/common-table-v3-v4.json`, with the file's inheritance rules (previous section ID → previous difficulty → Normal game mode) fully resolved at extraction time. The dataset SHALL cover Episode 1, Normal game mode, the difficulties Normal, Hard, Very Hard, and Ultimate, and all 10 section IDs, and SHALL carry per scenario: the weapon type/subtype-base/subtype-area-length tables, grind table, armor type table + bias + slot-count table, enemy rt-index meseta ranges / drop probabilities / item classes, box meseta ranges, bonus value/spec/type tables, special mult and percent tables, unit max-stars table, tool-class table, and box item-class table. Technique tables SHALL NOT be carried.

#### Scenario: Inheritance is resolved offline

- **WHEN** the dataset is generated for a scenario whose source entry omits keys (e.g. Ep1 Normal-mode Hard Bluefull)
- **THEN** the emitted entry SHALL contain the complete table set, with omitted keys filled from the inheritance chain exactly as newserv resolves them, and the engine SHALL perform no inheritance resolution at runtime

#### Scenario: Known reference values

- **WHEN** the generated dataset is compared against hand-verified cells from the newserv source
- **THEN** sampled values (e.g. a `BaseWeaponTypeProbTable` row for a fully-specified scenario) SHALL match the source exactly

#### Scenario: Widening preserves existing rows

- **WHEN** the dataset is regenerated with Very Hard included
- **THEN** the Normal, Hard, and Ultimate entries SHALL be unchanged from the previous dataset

### Requirement: Sliced rare-drop dataset

The engine SHALL ship a checked-in, generated dataset of rare-drop specs derived from newserv's `system/tables/rare-table-v4.json`, sliced to Episode 1, Normal game mode, the difficulties Normal, Hard, Very Hard, and Ultimate, and all 10 section IDs. Each spec SHALL carry a normalized drop probability (converted from the source's 2^32-denominator integers or fraction strings) and the resolved item code. Specs whose item code does not resolve to a weapon, frame, barrier, or unit in the item-parameter dataset SHALL be excluded at extraction time.

#### Scenario: Probability normalization

- **WHEN** a source spec expresses its probability as a fraction string (e.g. "3/32") or a 32-bit integer
- **THEN** the emitted spec SHALL carry the equivalent numeric probability such that both forms of the same odds produce the same value

#### Scenario: Non-gear rares are excluded

- **WHEN** a source spec's item code resolves to a tool, mag, or meseta
- **THEN** the spec SHALL NOT appear in the emitted dataset
