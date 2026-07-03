# loot-economy Delta

## MODIFIED Requirements

### Requirement: Drop generation

Enemies and item boxes SHALL generate drops via the authentic drop generator (drop-generation capability), keyed by the character's section ID, the run's difficulty, and the area — producing meseta, gear with generated variance, usable consumables, grinders, and inert tool items. The hand-authored drop tables and placeholder gear templates SHALL be removed. All drop rolls SHALL use the run's seeded RNG.

#### Scenario: Enemy produces a seeded drop

- **WHEN** an enemy dies
- **THEN** the system SHALL roll its drop through the authentic generator using the run's seeded RNG, so the same run reproduces the same drops

#### Scenario: Box produces a seeded drop

- **WHEN** an item box is opened
- **THEN** the system SHALL roll its drop through the authentic generator using the run's seeded RNG

#### Scenario: Placeholder gear cannot drop

- **WHEN** any drop is generated
- **THEN** the resulting item SHALL be defined by the authentic item-parameter dataset, never by a hand-authored placeholder template

### Requirement: Meseta currency

Meseta SHALL be the currency earned from drops and auto-sold items and spent in the meta layer. Meseta from enemies SHALL arrive only as drops rolled by the drop generator (a kill MAY pay nothing); there SHALL be no separate guaranteed per-kill meseta award. The player's meseta balance SHALL persist across runs.

#### Scenario: Meseta accrues from a run

- **WHEN** a run collects meseta drops and/or auto-sells items
- **THEN** the amounts SHALL be added to the player's persistent meseta balance and reflected in the run report

#### Scenario: A kill can pay nothing

- **WHEN** an enemy dies and its drop-anything roll fails
- **THEN** the player's meseta SHALL be unchanged by that kill

## ADDED Requirements

### Requirement: Inert tool items in the economy

Inert tool items (non-mate, non-atomizer, non-grinder tools) SHALL enter the shared inventory through the loot filter like gear, valued by their authentic sell price, and SHALL be sellable but not usable.

#### Scenario: Tool item is filterable and sellable

- **WHEN** an inert tool item drops whose sell value is below the auto-sell bar
- **THEN** it SHALL be auto-sold like any other low-value item
