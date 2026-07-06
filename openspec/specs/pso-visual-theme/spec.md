# pso-visual-theme Specification

## Purpose
Give the UI an authentic PSO Blue Burst look: CSS-only window chrome, a tokenized palette, PSO-style menus and controls, Gulim-style typography with fallback, and a HUD-over-scene responsive layout. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: PSO window treatment in CSS
The UI SHALL render its panels in a PSO Blue Burst-styled window treatment implemented purely in CSS (no image slicing): a translucent dark-teal fill with a subtle scanline texture, a cyan border with edge glow, and an organic silhouette using asymmetric rounded corners (one visibly larger sweep corner). Named windows SHALL carry an orange gradient tab header overlapping the window's top edge, holding the window's title and optional trailing content (counts, pagination); the tab SHALL be a real element, not a pseudo-element. The palette (window fill, cyan edge, orange selection/tab, HP green, TP blue, meseta gold, rarity colors) SHALL be defined as CSS custom properties. Raster assets SHALL NOT be load-bearing for window chrome; the reference material MAY inform geometry and color only. Window fills SHALL remain dark/opaque enough over the animated scene that muted text keeps readable contrast.

#### Scenario: Windows render without raster chrome
- **WHEN** any top-level window is rendered
- **THEN** its frame, fill, silhouette, and tab header SHALL be produced by CSS alone and remain sharp at any viewport size

#### Scenario: Named window shows its tab
- **WHEN** a named hub window (e.g. the shop stock list) is rendered
- **THEN** an orange tab header with the window's title SHALL sit overlapping its top edge

#### Scenario: Palette from tokens
- **WHEN** a themed color is used anywhere in the UI
- **THEN** it SHALL resolve from the CSS custom property palette rather than a hard-coded literal

### Requirement: PSO menu and control styling
Interactive lists outside shop stock lists SHALL use PSO-style menu rows with an orange highlight bar on hover/selection; when the highlight moves between rows of the same menu, the bar SHALL animate its movement with a brief slide (respecting `prefers-reduced-motion`). Shop stock lists (weapon counter, armour counter, tool shop) SHALL instead use the Nova-style card treatment defined by the shop-list-card capability, whose amber selected-state glow serves as the selection highlight for those lists. Each screen's primary action SHALL be visually distinguished (hexagonal or otherwise PSO-accented treatment); secondary actions SHALL use flat rectangular controls. HP bars SHALL keep their existing class-name contract (widths set by the battle stage) while restyled to the PSO green-on-dark-bezel look.

#### Scenario: Menu row highlight
- **WHEN** the player hovers or selects a menu/list row outside a shop stock list
- **THEN** the row SHALL show the orange PSO selection bar

#### Scenario: Highlight slides between rows
- **WHEN** the highlight moves from one row to an adjacent row of a non-shop menu and reduced motion is not requested
- **THEN** the orange bar SHALL animate the transition rather than jumping

#### Scenario: Shop lists select via the card treatment
- **WHEN** the player hovers or selects an offer in a shop stock list
- **THEN** the Nova card's cool hover / warm selected treatment SHALL apply and no orange highlight bar SHALL render

#### Scenario: HP bar contract preserved
- **WHEN** the battle stage updates an HP bar's width during a run
- **THEN** the restyled bar SHALL reflect the update using the same element/class structure as before the theme change

### Requirement: Typography
The UI SHALL load a freely redistributable Gulim look-alike typeface (Nanum Gothic, SIL OFL) via `@font-face` from a locally served font asset with `font-display: swap` and a system-font fallback stack, so layout SHALL remain usable when the font is unavailable. The font's license SHALL ship alongside the asset, and the provenance (Gulim being PSO BB's original, non-redistributable typeface) SHALL be noted in a source comment at the `@font-face` declaration.

#### Scenario: Font fallback
- **WHEN** the font asset fails to load
- **THEN** text SHALL render in the fallback stack with no broken layout

### Requirement: HUD-over-scene responsive layout
The hub SHALL lay out as a HUD: floating windows anchored toward the viewport's corners and edges on a named-area CSS grid over the scene layer, with unclaimed space showing the scene rather than stretched panels. The layout SHALL remain responsive and fullscreen at all viewport widths with no fixed-aspect letterboxing. On desktop, long content SHALL scroll inside its window and the page itself SHALL NOT scroll; below roughly 1100px the detail column SHALL reflow beneath the pane window; below roughly 900px the HUD SHALL collapse to a vertical stack (scene still behind) where page scrolling is permitted. Horizontal page scrolling SHALL never occur.

#### Scenario: Wide viewport shows scene, not stretched panels
- **WHEN** the hub is shown at a viewport wider than 1400px
- **THEN** windows SHALL keep bounded widths anchored to their HUD regions and the remaining space SHALL show the animated scene

#### Scenario: Lists scroll within windows on desktop
- **WHEN** a shop list exceeds its window's height on a desktop viewport
- **THEN** the list SHALL scroll inside the window while the page does not scroll

#### Scenario: Narrow viewport collapses
- **WHEN** the viewport is narrower than about 900px
- **THEN** the hub SHALL collapse to a single-column stacked layout with all windows reachable via vertical page scroll
