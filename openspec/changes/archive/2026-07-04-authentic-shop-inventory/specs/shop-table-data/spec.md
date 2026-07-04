# shop-table-data Delta

## ADDED Requirements

### Requirement: Extracted shop random-set dataset
The engine SHALL ship a checked-in, generated dataset of authentic Blue Burst shop random-set tables derived from newserv's `system/tables/armor-shop-random-set.json`, `tool-shop-random-set.json`, and `weapon-shop-random-set-{normal,hard,very-hard,ultimate}.json`. The dataset SHALL carry: the armor/shield/unit weighted subtype tables per level tier; the tool shop common-recovery rows, rare-recovery weighted tables, tech-disk weighted tables, and tech-disk level tables (all three level modes: level-1, player-level-divisor, min/max range); and, per difficulty, the weapon type weight tables per section ID, bonus type/range tables, special mode tables, and default/favored grind range tables.

#### Scenario: Known reference values
- **WHEN** the generated dataset is compared against hand-verified cells from the newserv source files
- **THEN** sampled values (e.g. the armor table's first level-tier row, a Normal weapon type weight row for a given section ID) SHALL match the source exactly

#### Scenario: Regeneration is reproducible
- **WHEN** the extraction script is re-run against the unchanged newserv clone
- **THEN** the emitted dataset SHALL be byte-identical to the checked-in file

### Requirement: newserv code constants resolved at extraction
The extraction SHALL bake in the mapping constants that live in newserv code rather than data — the tool-shop item definitions and technique number map, the weapon type definitions including the section-ID-dependent codes 0x39/0x3A, the bonus value list, and the favored weapon type per section ID — resolving them into dataset lookups so the runtime consumes data only. Each baked constant SHALL carry a provenance comment citing its newserv `file:line`.

#### Scenario: Section-ID-dependent weapon codes are resolved
- **WHEN** the dataset is generated
- **THEN** weapon type entries 0x39 and 0x3A SHALL be emitted as per-section-ID item code lookups matching newserv's `type_defs_39`/`type_defs_3A`

#### Scenario: Tool entries resolve to item codes
- **WHEN** a tool-shop table entry index is looked up through the dataset
- **THEN** it SHALL resolve to the item code newserv's `item_defs` maps it to (e.g. entry 0x00 → Monomate), with 0x0F representing "no item"
