# player-hud Specification

## Purpose
Provide the PSO-authentic player HUD capsule — hex character icon with Photon Blast badge, HP/TP bars, level pill, section ID glyph and yellow name — shared between the hub and run screens, plus the section ID glyph set. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: PSO player HUD capsule
The UI SHALL provide a shared player HUD component rendered as a single PSO Blue Burst-style capsule: one continuous cyan-outlined rounded enclosure containing, in order — a hexagonal character icon half-overlapping the capsule's left edge with a Photon Blast badge number riding its top-right; an HP row (label `HP`, a green-on-dark-bezel fill bar, and right-aligned `current/max` numbers); a TP row of identical structure (label `TP`); a `Lv N` pill hanging off the capsule's bottom-left; and the character's name in yellow, right-aligned below the bars, with the character's section ID glyph beside it. The same component (same DOM structure and class hooks) SHALL be used on the hub and the run screen.

#### Scenario: Capsule anatomy
- **WHEN** the player HUD is rendered for a character
- **THEN** it SHALL show the hex icon with badge, HP row with `current/max`, TP row, `Lv N` pill with the character's level, and the yellow name with a section ID glyph, all inside one capsule outline

#### Scenario: One component, two screens
- **WHEN** the hub and the run screen each render the player HUD
- **THEN** both SHALL render identical markup structure and class hooks from the shared component

### Requirement: Placeholder gauges are the authentic empty states
Because the game has no techniques or Photon Blast systems yet, the TP row SHALL render as a real bar at zero fill with the text `0/0`, and the Photon Blast badge SHALL render the number `0` with no gauge fill on the hex. These SHALL be the same DOM elements a future techniques/Photon Blast system would drive (no throwaway markup).

#### Scenario: TP row shows empty gauge
- **WHEN** the player HUD is rendered
- **THEN** the TP bar SHALL show zero fill and the text `0/0`

#### Scenario: Photon Blast badge shows zero
- **WHEN** the player HUD is rendered
- **THEN** the hex icon's badge SHALL read `0` with no radial/gauge fill

### Requirement: Section ID glyphs
The UI SHALL provide an SVG glyph for each of the ten PSO section IDs (Viridia, Greenill, Skyly, Bluefull, Purplenum, Pinkal, Redria, Oran, Yellowboze, Whitill), registered in the existing SVG sprite system and rendered via the shared `Icon` mechanism. Each glyph SHALL use its section ID's canonical color and SHALL be legible at name-plate size. Raster assets SHALL NOT be used.

#### Scenario: Glyph shown beside the name
- **WHEN** the player HUD renders a character whose section ID is Skyly
- **THEN** the Skyly glyph SHALL appear beside the character's name in the capsule

#### Scenario: All ten section IDs resolve
- **WHEN** a character has any of the ten section IDs
- **THEN** a matching glyph symbol SHALL exist in the sprite sheet and render without fallback

### Requirement: Imperative HP hook contract
The capsule's HP fill element and HP text element SHALL keep the established battle-stage hook classes (`stage-char-hp`, `stage-char-hp-text`) so the imperative `BattleStage` can drive live HP during a run without reactive plumbing, and the capsule root SHALL carry a stable class for the stage's hurt/heal flash effects. On the hub, the capsule SHALL display the character's effective max HP as `max/max`.

#### Scenario: Stage drives HP during a run
- **WHEN** the battle stage applies a damage or heal event during a run
- **THEN** the capsule's HP bar width and `current/max` text SHALL update via the existing class hooks, and the capsule SHALL receive the hurt/heal flash

#### Scenario: Hub shows full HP
- **WHEN** the hub renders the capsule for a character with effective max HP of 52
- **THEN** the HP row SHALL read `52/52` with a full bar
