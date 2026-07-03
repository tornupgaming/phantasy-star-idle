# Proposal: pso-hud-menus

## Why

The hub currently reads as an admin dashboard with a teal skin: full-width rectangular panels in a document flow, form controls (`<select>`s, checkboxes) on the Guild pane, sparse two-panel shops, and no sense of place. The PSO reference material the game is homaging works the opposite way — small, dense, corner-anchored windows floating over a living scene, orange tab headers, item icons, and a shopkeeper's voice. On a modern monitor the current layout wastes most of the screen and delivers none of the personality.

## What Changes

- **HUD-over-scene layout (responsive fullscreen).** The hub becomes a full-viewport scene layer with floating, corner-anchored windows over it, replacing the document-flow grid. Stays responsive at all widths — no fixed-aspect letterboxing.
- **Animated Pioneer 2 backdrops.** Each hub pane gets a CSS/canvas-drawn diegetic backdrop (scrolling teal glyph walls, per-shop tint and motif) behind the windows.
- **Window anatomy v2.** Orange tab headers naming each window, curved/organic window silhouettes with connector stems, a PSO-style status *cluster* (hex level chip, name, HP-style bars, money pill) replacing the full-width status bar.
- **Shopkeeper dialogue.** Greeting lines per shop, contextual prompts ("What do you want to sell?"), reactive confirmations, and flavor descriptions on items — rendered in PSO dialogue windows.
- **Item iconography and density.** Item-kind glyphs on every list row, quantities right-aligned, equipped/rarity name colors, PSO-density row heights.
- **Guild pane redesign.** Area, difficulty, and attack pattern chosen through PSO menu rows and chips instead of form controls; the quest counter reads like BB's, not a settings form.
- **BREAKING (spec-level):** the `pso-visual-theme` "Full-width layout" requirement (three-column grid document flow) is replaced by the HUD layout requirement.

## Capabilities

### New Capabilities

- `hub-scene-backdrop`: The animated, per-pane diegetic backdrop layer behind the hub's floating windows.
- `shop-dialogue`: Shopkeeper greetings, prompts, reactions, and item flavor text across the shop, bank, and guild panes.
- `item-iconography`: Item-kind glyphs, quantity alignment, and semantic name coloring in all item lists.

### Modified Capabilities

- `pso-visual-theme`: Window treatment gains tab headers and organic silhouettes; the full-width three-column layout requirement is replaced by the HUD-over-scene floating-window layout; menu rows gain a density requirement; the hub status presentation changes from a bar to a corner-anchored status cluster.
- `ui-navigation`: The Hunters Guild pane's quest counter changes from form controls to PSO menu-row/chip selection; the hub shell requirement changes from master-detail (sidebar + detail region) to HUD (floating nav window + pane windows over the scene). Status bar content requirements are preserved but re-homed to the status cluster.

## Impact

- **Code:** `src/ui/views.ts` (hub shell, all panes, guild counter), `src/ui/styles.css` (layout model, window chrome, new backdrop/dialogue/icon styles), new `src/ui/backdrop.ts` (scene layer) and small data modules for dialogue lines and item flavor. Possibly `src/ui/assets/` gains an item-glyph sheet (same pixel-art pipeline as enemy art).
- **Untouched:** the engine (`src/engine/*`) — this is presentation-only; no save shape, no game logic, no RNG. The run screen and battle stage keep their existing contracts (HP bar class names, stage-owned DOM).
- **Screens in scope:** hub + its six panes, and the shared window chrome (which character select/create inherit). Run screen only inherits chrome changes, not the HUD restructure.
