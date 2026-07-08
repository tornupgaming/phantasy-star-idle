# enemy-stat-data Specification

## Purpose
Provide a checked-in, reproducibly generated dataset of authentic PSO Blue Burst enemy stats (from newserv's Solo battle-params tables) and make combat and content tables consume it: difficulty selects the authentic stat row, and area rosters reference only authentic Episode 1 enemies. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Condensed authentic enemy stat dataset

The engine SHALL ship a checked-in, generated dataset of authentic PSO Blue Burst enemy stats derived from newserv's `battle-params.json` **Solo** tables, keyed by enemy type, episode, and difficulty (Normal, Hard, Very Hard, Ultimate). Each row SHALL contain at minimum HP, ATP, DFP, ATA, EVP, LCK, ESP, EXP, and meseta, and SHALL carry resist data (EFR, EIC, ETH, ELT, EDK, EVP/DFP bonuses) and the Ultimate display name where one exists.

#### Scenario: Stats match the Blue Burst source

- **WHEN** the dataset row for an enemy type, episode, and difficulty is compared against the newserv Solo table entry at that enemy's stats BP index
- **THEN** every field SHALL match the source value exactly (no rounding, scaling, or re-tuning)

#### Scenario: Known reference values

- **WHEN** the dataset is generated
- **THEN** Episode 1 BOOMA SHALL have 60 HP and 80 ATP on Normal (1556 HP on Ultimate), and DRAGON SHALL have 1300 HP and 350 EXP on Normal (Solo-table values)

### Requirement: Reproducible extraction pipeline

A script in the repository SHALL regenerate the dataset from a local newserv clone by joining `battle-params.json` with the enemy definition table parsed from newserv's `EnemyType.cc`. The script SHALL NOT use the episode-agnostic `Enemies` annotations embedded in `battle-params.json` to associate enemies with stat entries, and SHALL fail with a diagnostic (rather than emit a partial dataset) when the parsed enemy definition table or BP indexes do not match expectations.

#### Scenario: Regeneration is deterministic

- **WHEN** the extraction script is run twice against the same newserv clone
- **THEN** it SHALL produce byte-identical dataset output

#### Scenario: Upstream format drift is detected

- **WHEN** the enemy definition table parse yields an unexpected row count or an enemy references a BP index outside the source table bounds
- **THEN** the script SHALL exit with an error identifying the mismatch and SHALL NOT overwrite the existing dataset

### Requirement: Difficulty selects authentic stat rows in combat

Enemies instantiated in a run SHALL take their combat stats (HP, ATP, DFP, ATA, EVP, LCK) and their EXP award from the dataset row matching the enemy's type and the run's difficulty. Difficulty-based stat multipliers SHALL NOT be applied to dataset-backed stats. Kill XP SHALL be the dataset EXP value scaled by the single global XP rate (`XP_RATE`, an idle-pacing knob), truncated to an integer; no other scaling SHALL apply. Meseta SHALL NOT be awarded from the stat row; enemy meseta arrives only through drop generation (drop-generation capability).

#### Scenario: Same enemy across difficulties

- **WHEN** the same enemy type is fought on Normal and on Hard
- **THEN** each instance SHALL use its respective difficulty row from the dataset (e.g. Booma 60 HP / 80 ATP on Normal, 386 HP / 362 ATP on Hard — Solo Episode 1 values)

#### Scenario: Kill rewards scale the dataset value by the global XP rate

- **WHEN** an enemy is killed on a given difficulty
- **THEN** the XP awarded SHALL equal `floor(dataset EXP × XP_RATE)` for that enemy and difficulty, and the kill log event SHALL carry that scaled value

#### Scenario: No stat-row meseta on kill

- **WHEN** an enemy is killed
- **THEN** no meseta SHALL be awarded from its stat row; any meseta from the kill SHALL come from the drop generator's roll

### Requirement: Area rosters use authentic enemies

Area definitions SHALL reference only enemy types that exist in PSO Episode 1, under their authentic names. Non-authentic placeholder enemies SHALL NOT appear in any area roster.

#### Scenario: Placeholders removed

- **WHEN** the content tables are loaded
- **THEN** no area room SHALL reference "Rag Crab" or "Savage Bat", and the machine enemy SHALL be named "Gillchic"

#### Scenario: Every roster entry resolves to dataset stats

- **WHEN** any area room lists an enemy id
- **THEN** that enemy SHALL resolve to an Episode 1 entry in the stat dataset for all four difficulties
