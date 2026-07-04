# run-simulation Delta

## ADDED Requirements

### Requirement: Four selectable difficulties
The game SHALL offer four run difficulties — Normal, Hard, Very Hard, and Ultimate, in that order — all freely selectable. Very Hard SHALL sit between Hard and Ultimate with a meseta multiplier of 3 (within the existing 1/2/4 curve), and runs at Very Hard SHALL use the authentic `vhard` enemy stat rows and the Very Hard drop tables.

#### Scenario: Very Hard run uses authentic data
- **WHEN** a character is dispatched at Very Hard
- **THEN** enemies SHALL instantiate from the `vhard` stat rows and drops SHALL roll from the Very Hard drop tables, with meseta scaled ×3

#### Scenario: No unlock gate
- **WHEN** a new character views the difficulty picker
- **THEN** all four difficulties SHALL be selectable (under-geared characters are gated only by ejection)
