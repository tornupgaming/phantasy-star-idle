# enemy-stat-data Delta

## MODIFIED Requirements

### Requirement: Difficulty selects authentic stat rows in combat

Enemies instantiated in a run SHALL take their combat stats (HP, ATP, DFP, ATA, EVP, LCK) and their EXP award from the dataset row matching the enemy's type and the run's difficulty. Difficulty-based stat multipliers SHALL NOT be applied to dataset-backed stats. Meseta SHALL NOT be awarded from the stat row; enemy meseta arrives only through drop generation (drop-generation capability).

#### Scenario: Same enemy across difficulties

- **WHEN** the same enemy type is fought on Normal and on Hard
- **THEN** each instance SHALL use its respective difficulty row from the dataset (e.g. Booma 60 HP / 80 ATP on Normal, 386 HP / 362 ATP on Hard — Solo Episode 1 values)

#### Scenario: Kill rewards come from the dataset

- **WHEN** an enemy is killed on a given difficulty
- **THEN** the XP awarded SHALL equal the dataset EXP value for that enemy and difficulty

#### Scenario: No stat-row meseta on kill

- **WHEN** an enemy is killed
- **THEN** no meseta SHALL be awarded from its stat row; any meseta from the kill SHALL come from the drop generator's roll
