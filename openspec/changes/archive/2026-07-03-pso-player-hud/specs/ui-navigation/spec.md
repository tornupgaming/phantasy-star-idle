## MODIFIED Requirements

### Requirement: Hub status bar
Every hub pane SHALL display the shared PSO player HUD capsule anchored top-left (see the `player-hud` capability for its anatomy: hex icon with Photon Blast badge, HP and TP bars, level pill, section ID glyph and yellow name). Immediately adjacent to the capsule, the hub SHALL display a side panel window showing the character's XP progression — total XP plus XP remaining to the next level rendered with a thin progress bar (or a max-level indication at the level cap) — and the shared economy: meseta balance and grinder count. Both SHALL reflect state changes (purchases, XP, level-ups) on re-render. There SHALL be no separate money pod window, and the class name SHALL NOT appear in the hub HUD. The character select and character create screens SHALL NOT display the capsule or side panel; the run view SHALL display the capsule (per `battle-scene-view`) but NOT the side panel.

#### Scenario: Hub HUD content
- **WHEN** any hub pane is shown
- **THEN** the top-left SHALL show the player HUD capsule, and the adjacent side panel SHALL show total XP, XP-to-next progress, meseta, and grinders

#### Scenario: Side panel updates on purchase
- **WHEN** the player completes a purchase on any shop pane
- **THEN** the side panel's meseta value SHALL reflect the new balance

#### Scenario: Side panel is hub-only
- **WHEN** a run is active and the run screen is shown
- **THEN** the player HUD capsule SHALL be visible but the XP/economy side panel SHALL NOT be
