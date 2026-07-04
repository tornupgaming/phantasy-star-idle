# item-pricing Delta

## ADDED Requirements

### Requirement: Authentic buy prices
Item buy prices SHALL be computed by a port of newserv's `ItemParameterTable::price_for_item`, with integer truncation preserved: weapons priced as 1000·specialStars² + (atpMax + grind)² / saleDivisor · bonusFactor / 100 (where bonusFactor sums 100 + bonusValue over bonus slots of types 1–5), rare weapons flat 80, untekked weapons flat 8; armors and shields priced as ⌊(dfp + evp)² / saleDivisor⌋ + 70 · (slots + 1) · (requiredLevel + 1), rare armor flat 80; units priced as adjusted stars · unit sale divisor; tools priced at their authentic cost, and technique disks at cost · (disk level); shop offers SHALL display and charge exactly this price.

#### Scenario: Weapon price reflects grind, special, and bonuses
- **WHEN** two copies of the same weapon differ only in grind, special, or percent bonuses
- **THEN** their prices SHALL differ exactly as the formula dictates (higher grind, higher special stars, or positive bonuses cost more)

#### Scenario: Tech disk price scales with level
- **WHEN** the same technique is offered at two disk levels
- **THEN** each SHALL be priced at the tool's cost multiplied per newserv's disk-level rule

#### Scenario: Reference prices match newserv
- **WHEN** computed prices are compared against hand-verified values from the newserv formulas for sampled items
- **THEN** they SHALL match exactly, including integer truncation

### Requirement: Sell-back is one eighth of buy price
An item's sell value SHALL be its authentic buy price arithmetically shifted right by 3 (÷8, truncated), replacing all placeholder sell-value formulas. This value SHALL be used by inventory selling and loot-filter auto-sell alike.

#### Scenario: Sell value derives from price
- **WHEN** any item's sell value is computed
- **THEN** it SHALL equal price_for_item(item) >> 3

### Requirement: Placeholder pricing removed
The placeholder sell-value formula and the flat ×3 shop markup SHALL be removed; no price or sell value in the game SHALL come from a non-authentic formula. Hand-set consumable prices SHALL be replaced by the authentic tool costs from the item-parameter dataset.

#### Scenario: Consumables use authentic costs
- **WHEN** the tool counter offers a Monomate
- **THEN** its price SHALL be the authentic tool cost from the item-parameter dataset, not a hand-set constant
