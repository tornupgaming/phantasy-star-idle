# shop-list-card Specification (delta)

## ADDED Requirements

### Requirement: Nova card anatomy
Shop stock lists (weapon counter, armour counter, tool shop) SHALL render each offer as a Nova-style card rather than a flat menu row. Each card SHALL comprise: a numbered slot tab hanging off the card's left edge (1-based stock order, tabular numerals); a recessed square icon well showing the item's kind glyph; a two-line body (name row, then a per-kind stat row); and a right rail carrying the meseta price and, when applicable, the equip-requirement line. The list container SHALL reserve left padding so the slot-tab overhang is never clipped.

#### Scenario: Card structure

- **WHEN** a gear shop lists an offer
- **THEN** the row renders as a card with slot tab, icon well, name row, per-kind stat row, and a right rail with the meseta price

#### Scenario: Slot numbering

- **WHEN** the shop stocks N offers
- **THEN** the cards' slot tabs read 1..N in display order

### Requirement: Layered glass finish
The card SHALL use the layered glass treatment: a bright cyan-white outer hairline border over a dark inner keyline (inset shadow), a top-lit vertical gradient fill from the card-glass tokens, an inset top-light highlight, and a soft drop shadow lifting the card off the window fill. The icon well SHALL read as recessed (inner shadow plus a faint top radial glow) with the glyph carrying a soft cyan drop-shadow. All colors introduced by the card (chip hues, card glass, brass/pewter tab states) SHALL be defined as CSS custom properties in the theme palette.

#### Scenario: Glass layers present

- **WHEN** a card renders at rest
- **THEN** it shows the bright outer hairline, the dark inner keyline, the top-lit gradient fill, and the drop shadow as distinct layers (not a single flat border)

#### Scenario: Colors resolve from tokens

- **WHEN** any card, chip, or tab color is used
- **THEN** it resolves from a CSS custom property rather than a hard-coded literal in component styles

### Requirement: Warm-on-cool interaction states
Selection SHALL be the only warm element in the list: the selected card gets an amber double outline (light warm border plus offset warm ring), a warm inset top-light, an amber outer glow, and a lightened fill; its slot tab switches from dim pewter to brass (white numeral, warm border, glow). Hover SHALL brighten only the cool channel (hairline and cyan bloom) and SHALL NOT introduce warm color. State transitions SHALL animate border and shadow over roughly 140ms and SHALL be disabled under `prefers-reduced-motion`. Cards SHALL remain focusable buttons with a visible focus outline.

#### Scenario: Selected card glows warm

- **WHEN** the player selects a card
- **THEN** that card alone shows the amber double outline and glow, and its slot tab lights brass, while all other cards stay cool

#### Scenario: Hover stays cool

- **WHEN** the pointer hovers an unselected card
- **THEN** the card's cyan edge brightens with a cyan bloom and no amber appears

#### Scenario: Reduced motion respected

- **WHEN** the OS requests reduced motion
- **THEN** state changes apply instantly with no transition

### Requirement: Per-kind chip stat row
The card's second line SHALL vary by item kind, using small rounded colored chips with dark-ink lettering. Weapons SHALL always show the four attribute chips — N (green), A (orange), M (blue), D (purple) — with their percentages, plus a gold HIT chip only when hit is greater than 0; zero-valued attributes keep their chip but render desaturated with dimmed value text so nonzero rolls stand out. Frames SHALL show blue DFP and teal EVP chips as current/max rolls plus a slate SLOT chip with the unit-slot count; barriers SHALL show DFP and EVP only. When no stat ceiling is available for an armour definition, the value SHALL render flat (no `/max`). Tool offers SHALL show a compact effect/stock summary line in place of chips.

#### Scenario: Weapon attribute chips

- **WHEN** a weapon with a nonzero machine attribute and zero others is listed
- **THEN** the M chip and value render at full strength while N, A, and D render desaturated with dimmed zeros

#### Scenario: HIT chip is conditional

- **WHEN** a weapon's hit bonus is 0
- **THEN** no HIT chip renders; **WHEN** hit is greater than 0 a gold HIT chip renders with the value

#### Scenario: Frame rolls with slots

- **WHEN** a frame with DFP 32 of a possible 35 and 2 unit slots is listed
- **THEN** the row reads DFP 32/35, EVP current/max, and SLOT 2

#### Scenario: Barrier has no slot chip

- **WHEN** a barrier is listed
- **THEN** the row shows DFP and EVP chips and no SLOT chip

### Requirement: Name row semantics
The name row SHALL keep the existing rarity coloring (common near-white, uncommon accent cyan, rare gold with glow) and SHALL render a weapon's grind as a green `+N` suffix. Names SHALL stay on one line with ellipsis overflow.

#### Scenario: Ground weapon

- **WHEN** a weapon at grind 3 is listed
- **THEN** the name reads with a green `+3` suffix in the rarity-colored name row

### Requirement: Equip requirement line
When a listed item carries equip requirements, the right rail SHALL show a requirement line beneath the price in the format `Req. <STAT> <needed> (<current>)`, evaluated against the selected character's base stats per the existing equip-gating rules. The line SHALL render white when the character meets the requirement and grey when they do not. Items without requirements SHALL show no line.

#### Scenario: Requirement met

- **WHEN** a weapon requires 32 ATP and the character's base ATP is 76
- **THEN** the card shows `Req. ATP 32 (76)` in white

#### Scenario: Requirement unmet

- **WHEN** an item's requirement exceeds the character's base stat
- **THEN** the requirement line renders grey

#### Scenario: Curated gear

- **WHEN** a curated offer without requirements is listed
- **THEN** no requirement line renders

### Requirement: Selection semantics preserved
Cards SHALL remain semantic buttons wired to the existing detail-pane selection (`detailId`), exposing `aria-selected` inside a `role="listbox"` container, so buying flow, keyboard focus, and the detail pane behave exactly as with the flat rows. The hub's keyboard navigation SHALL treat card stacks as menus — listbox containers enumerate alongside PSO menus (with the same focused-menu indicator) and arrow keys step the selected option.

#### Scenario: Card click opens detail

- **WHEN** the player activates a card
- **THEN** the detail pane shows that item, and the card reflects `aria-selected="true"`

#### Scenario: Arrow keys step cards

- **WHEN** keyboard focus is on a shop card stack and the player presses ArrowDown
- **THEN** selection moves to the next card (amber treatment follows) and the detail pane updates
