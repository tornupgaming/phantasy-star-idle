# pso-visual-theme Specification

## Purpose
Give the UI an authentic PSO Blue Burst look: CSS-only window chrome, a tokenized palette, PSO-style menus and controls, Gulim-style typography with fallback, and a full-width responsive layout. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: PSO window treatment in CSS
The UI SHALL render its panels in a PSO Blue Burst-styled window treatment implemented purely in CSS (no image slicing): a translucent dark-teal fill with a subtle scanline texture, a cyan border with edge glow, and one clipped corner. The palette (window fill, cyan edge, orange selection, HP green, TP blue, meseta gold, rarity colors) SHALL be defined as CSS custom properties. Raster assets SHALL NOT be load-bearing for window chrome; the reference spritesheet MAY inform geometry and color only.

#### Scenario: Windows render without raster chrome
- **WHEN** any top-level panel is rendered
- **THEN** its frame, fill, and corner clipping SHALL be produced by CSS alone and remain sharp at any viewport size

#### Scenario: Palette from tokens
- **WHEN** a themed color is used anywhere in the UI
- **THEN** it SHALL resolve from the CSS custom property palette rather than a hard-coded literal

### Requirement: PSO menu and control styling
Interactive lists SHALL use PSO-style menu rows with an orange highlight bar on hover/selection. Each screen's primary action SHALL be visually distinguished (hexagonal or otherwise PSO-accented treatment); secondary actions SHALL use flat rectangular controls. HP bars SHALL keep their existing class-name contract (widths set by the battle stage) while restyled to the PSO green-on-dark-bezel look.

#### Scenario: Menu row highlight
- **WHEN** the player hovers or selects a menu/list row
- **THEN** the row SHALL show the orange PSO selection bar

#### Scenario: HP bar contract preserved
- **WHEN** the battle stage updates an HP bar's width during a run
- **THEN** the restyled bar SHALL reflect the update using the same element/class structure as before the theme change

### Requirement: Typography
The UI SHALL load a freely redistributable Gulim look-alike typeface (Nanum Gothic, SIL OFL) via `@font-face` from a locally served font asset with `font-display: swap` and a system-font fallback stack, so layout SHALL remain usable when the font is unavailable. The font's license SHALL ship alongside the asset, and the provenance (Gulim being PSO BB's original, non-redistributable typeface) SHALL be noted in a source comment at the `@font-face` declaration.

#### Scenario: Font fallback
- **WHEN** the font asset fails to load
- **THEN** text SHALL render in the fallback stack with no broken layout

### Requirement: Full-width layout
The application root SHALL NOT constrain content to a fixed max-width; screens SHALL lay out against the full viewport width with padding gutters. The hub SHALL use a three-column grid on wide viewports and collapse to a single column on narrow viewports (below roughly 900px).

#### Scenario: Wide viewport uses full width
- **WHEN** the viewport is wider than 1400px
- **THEN** hub content SHALL span the viewport (minus gutters) in three columns rather than centering at a fixed width

#### Scenario: Narrow viewport collapses
- **WHEN** the viewport is narrower than about 900px
- **THEN** the hub SHALL collapse to a single-column layout with all sections reachable
