## ADDED Requirements

### Requirement: Class-derived base stats
Each character's base stats SHALL be derived from its class and level using the ported PSO Blue Burst level table: class base stats plus the sum of per-level growth deltas up to the character's level, clamped to the class's stat caps. Derived stats SHALL be deterministic — the same class and level always produce the same base stats.

#### Scenario: Level 1 stats match the class table
- **WHEN** a character is created with a given class
- **THEN** its base stats SHALL equal that class's base stats from the ported Blue Burst level table

#### Scenario: Stats clamped at class caps
- **WHEN** accumulated growth would push a stat above the class's maximum for that stat
- **THEN** the derived stat SHALL be clamped to the class maximum

### Requirement: Experience and leveling
Characters SHALL accumulate experience points from runs. A character's level SHALL be determined by its total XP against the ported per-class XP thresholds, up to level 200. Level and XP SHALL persist per character.

#### Scenario: Level up on crossing a threshold
- **WHEN** a character's total XP reaches the threshold for the next level
- **THEN** the character's level SHALL increase and its derived base stats SHALL reflect the new level

#### Scenario: Level cap
- **WHEN** a character is at level 200
- **THEN** additional XP SHALL NOT increase its level

### Requirement: XP awarded from runs
Enemies killed during a run SHALL award XP to the dispatched character. XP SHALL be applied when the run resolves, and level changes SHALL NOT alter the character's stats mid-run (the run uses its dispatch-time snapshot throughout). The run report SHALL include XP gained and any levels gained.

#### Scenario: XP applied at run resolution
- **WHEN** a run ends (complete or ejected)
- **THEN** the XP from all enemies killed during the run SHALL be added to the dispatched character, applying any level-ups at that point

#### Scenario: Mid-run stats are frozen
- **WHEN** XP earned during a run would cross a level threshold
- **THEN** the in-run combat stats SHALL continue to use the dispatch-time snapshot; the level-up takes effect only after resolution

#### Scenario: XP in run report
- **WHEN** a run report is presented
- **THEN** it SHALL include the XP gained and the character's resulting level

#### Scenario: XP is deterministic per seed
- **WHEN** the same run (same character snapshot, area, seed) is re-simulated
- **THEN** the XP gained SHALL be identical
