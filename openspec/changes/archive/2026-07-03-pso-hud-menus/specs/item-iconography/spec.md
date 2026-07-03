# item-iconography — delta

## ADDED Requirements

### Requirement: Item-kind glyphs on list rows
Every item list row (shop stock, inventory/bank, equipment candidates, tool shop) SHALL begin with a small glyph identifying the item kind (weapon, frame, barrier, unit, consumable, grinder). Glyphs SHALL be vector (inline SVG sprite) and SHALL inherit the row's text color so rarity and state coloring apply to the glyph automatically.

#### Scenario: Glyph matches item kind
- **WHEN** an item list renders a weapon and a frame
- **THEN** each row SHALL show the glyph for its item kind before the name

#### Scenario: Glyph inherits state color
- **WHEN** a row's name is colored by rarity or equipped state
- **THEN** its glyph SHALL render in the same color

### Requirement: Semantic name coloring and equipped marker
Item names SHALL be colored by state: rare items gold, uncommon items cyan (existing rarity colors preserved), and currently equipped items HP-green with a compact equipped marker. Coloring SHALL apply consistently across shop, bank, and equipment lists.

#### Scenario: Equipped item stands out in the bank
- **WHEN** the bank lists an item that is currently equipped by the selected character's loadout context (i.e. shown as "Equipped" today)
- **THEN** the equipped indication SHALL use the green treatment with the equipped marker

### Requirement: PSO-density rows with aligned trailing values
Item rows SHALL use PSO-density layout: compact visual height (roughly 24px on desktop) with quantities and prices right-aligned in tabular numerals. Interactive hit areas SHALL remain at least 28px tall despite the compact visual density, and density SHALL relax at the narrow-viewport breakpoint.

#### Scenario: Prices align in a column
- **WHEN** a shop list shows multiple items with prices
- **THEN** the prices SHALL be right-aligned so their digits form a column

#### Scenario: Hit areas stay usable
- **WHEN** the player clicks anywhere within a row's padded area
- **THEN** the row SHALL activate, with an effective target of at least 28px height
