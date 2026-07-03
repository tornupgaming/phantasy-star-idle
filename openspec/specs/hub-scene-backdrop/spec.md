# hub-scene-backdrop Specification

## Purpose
Render an animated Pioneer 2 scene layer behind the hub HUD, with per-pane theming and motion/performance safeguards. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Animated scene layer behind the hub
The hub SHALL render a full-viewport animated backdrop layer behind all hub windows, depicting a Pioneer 2 interior in the PSO idiom (walls of falling/flickering teal glyphs with gradient floor and vignette). The layer SHALL be rendered on a canvas element mounted outside the re-rendered window container, so hub window re-renders (purchases, selections, pane switches) SHALL NOT restart or stutter the animation.

#### Scenario: Backdrop survives window re-renders
- **WHEN** the player performs an action that re-renders the hub windows (e.g. buying an item)
- **THEN** the backdrop animation SHALL continue uninterrupted without remounting

#### Scenario: Backdrop fills the viewport
- **WHEN** the hub is shown at any viewport size
- **THEN** the backdrop SHALL cover the full viewport behind the floating windows with no untinted page background visible

### Requirement: Per-pane backdrop themes
Each hub pane SHALL declare a backdrop theme (tint, glyph density, and a faint motif silhouette identifying the location, e.g. crossed weapons for the Weapon Shop). Switching panes SHALL transition between themes with a crossfade rather than remounting the scene layer.

#### Scenario: Pane switch retints the scene
- **WHEN** the player navigates from one hub pane to another
- **THEN** the backdrop SHALL crossfade to the new pane's tint and motif without a visible remount

### Requirement: Motion and performance safeguards
The backdrop animation SHALL run at a capped low frame rate, SHALL pause while the document is hidden, and SHALL render as a single static frame when the user agent reports `prefers-reduced-motion: reduce`. The backdrop SHALL NOT use `Math.random`; any visual randomness SHALL come from a small local deterministic generator.

#### Scenario: Reduced motion
- **WHEN** the user agent reports `prefers-reduced-motion: reduce`
- **THEN** the backdrop SHALL render a static frame with no animation loop running

#### Scenario: Hidden tab pauses animation
- **WHEN** the document becomes hidden
- **THEN** the backdrop animation loop SHALL pause until the document is visible again
