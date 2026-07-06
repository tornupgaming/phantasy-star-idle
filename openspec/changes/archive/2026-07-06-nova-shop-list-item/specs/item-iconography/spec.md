# item-iconography Specification (delta)

## MODIFIED Requirements

### Requirement: Item-kind glyphs on list rows
Every item list row outside shop stock lists (inventory/bank, equipment candidates) SHALL begin with a small glyph identifying the item kind (weapon, frame, barrier, unit, consumable, grinder). Glyphs SHALL be vector (inline SVG sprite) and SHALL inherit the row's text color so rarity and state coloring apply to the glyph automatically. Shop stock lists SHALL instead identify item kind through the Nova card's icon well (shop-list-card capability), which renders the kind glyph as the card's thumbnail; those rows SHALL NOT additionally prefix the name with a glyph.

#### Scenario: Glyph matches item kind

- **WHEN** a non-shop item list renders a weapon and a frame
- **THEN** each row SHALL show the glyph for its item kind before the name

#### Scenario: Glyph inherits state color

- **WHEN** a non-shop row's name is colored by rarity or equipped state
- **THEN** its glyph SHALL render in the same color

#### Scenario: Shop rows carry kind in the icon well

- **WHEN** a shop stock list renders an offer
- **THEN** the item's kind glyph SHALL appear in the card's icon well and not as a prefix on the name row
