# shop-list-card Specification (delta)

## MODIFIED Requirements

### Requirement: Per-kind chip stat row
The card's second line SHALL vary by item kind, using small rounded colored chips with dark-ink lettering. Weapons SHALL always show the four attribute chips — N (green), A (orange), M (blue), D (purple) — with their percentages, plus a gold HIT chip only when hit is greater than 0, plus an AVD chip showing the weapon kind's avoidance percentage; zero-valued attributes keep their chip but render desaturated with dimmed value text so nonzero rolls stand out. Frames SHALL show blue DFP and teal EVP chips as current/max rolls plus a slate SLOT chip with the unit-slot count; barriers SHALL show DFP and EVP only. When no stat ceiling is available for an armour definition, the value SHALL render flat (no `/max`). Tool offers SHALL show a compact effect/stock summary line in place of chips.

#### Scenario: Weapon attribute chips
- **WHEN** a weapon with a nonzero machine attribute and zero others is listed
- **THEN** the M chip and value render at full strength while N, A, and D render desaturated with dimmed zeros

#### Scenario: HIT chip is conditional
- **WHEN** a weapon's hit bonus is 0
- **THEN** no HIT chip renders; **WHEN** hit is greater than 0 a gold HIT chip renders with the value

#### Scenario: AVD chip is always present on weapons
- **WHEN** any weapon is listed
- **THEN** an AVD chip renders with the avoidance percentage resolved from the weapon's kind (every kind has a value, so the chip is never absent)

#### Scenario: Frame rolls with slots
- **WHEN** a frame with DFP 32 of a possible 35 and 2 unit slots is listed
- **THEN** the row reads DFP 32/35, EVP current/max, and SLOT 2

#### Scenario: Barrier has no slot chip
- **WHEN** a barrier is listed
- **THEN** the row shows DFP and EVP chips and no SLOT chip
