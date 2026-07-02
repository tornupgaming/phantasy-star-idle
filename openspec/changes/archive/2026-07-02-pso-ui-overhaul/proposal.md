## Why

The current UI is a single generic 980px-wide "prep screen" that crams character sheet, roster, dispatch, inventory, and shop into one grid. It neither looks nor flows like Phantasy Star Online, and it wastes horizontal space on wide displays. We want the game to feel like PSO Blue Burst: boot into a character select screen, then play from a Pioneer 2 hub where shops, bank, and the Hunter's Guild are distinct destinations — all rendered in PSO BB's visual language.

## What Changes

- **New navigation flow** replacing the single prep screen with a UI-level screen router:
  - **Character select** (the entry screen on every load): scrollable grid of slot cards (name, class, level, section ID) plus an "empty slot" card that starts the create flow. Selecting a character enters Pioneer 2.
  - **Character create** (PSO BB order): class first, then name with derived section ID (override available but demoted to an advanced control).
  - **Pioneer 2 hub**: full-width three-column layout — character + equipment (left), Hunter's Guild quest counter = run dispatch (center), counter directory (right). "Change character" returns to character select.
  - **Shop/bank sub-screens behind separate clicks**: Weapon & Armor Shop (gear offers), Tool Shop (consumables + grinders), Bank (shared inventory: equip/sell). Each is a PSO-style menu view with list + detail pane.
  - **Post-run report** renders as a PSO-style dialog on the hub when a run settles (returning to Pioneer 2 after a quest); settling always forces the screen back to the hub.
  - Run view is unchanged in structure; it inherits the new full-width styling.
- **PSO BB visual theme, recreated in CSS** (no load-bearing sprites): teal translucent windows with cyan edge-light and clipped corner, scanline fill, orange selection bars, hexagon motif, green HP / blue TP bar styling, GULIM.TTC via `@font-face` with system fallback. Palette and geometry as CSS design tokens. The `assets_to_ingest/181631.png` spritesheet serves as visual reference only (optionally pictorial accents); note it and Gulim are not redistributable — fine for this personal project.
- **Full-width layout**: drop the 980px `#app` max-width; be bold with horizontal space.
- **Unlimited roster**: remove `ROSTER_CAP` (currently 4) from `engine/game.ts`. **BREAKING** for the roster-cap requirement (behavioral loosening only; save shape unchanged, no `SAVE_VERSION` bump).

## Capabilities

### New Capabilities
- `ui-navigation`: the screen flow — character select/create entry, Pioneer 2 hub, shop/bank/guild sub-screens, run-view override, post-run report placement.
- `pso-visual-theme`: the PSO BB look-and-feel — CSS design tokens, window/selection/bar treatments, typography, full-width layout rules.

### Modified Capabilities
- `character-roster`: remove the 4-character cap; the roster becomes unbounded (creation never rejected for roster size; "roster full" scenario removed).

## Impact

- **Code**: `src/ui/views.ts` (restructured into screen router + per-screen renderers), `src/ui/styles.css` (rewritten around PSO theme tokens), new font asset under `src/ui/assets/`, `src/main.ts` (unchanged tick loop; render entry only), `src/engine/game.ts` (delete `ROSTER_CAP` check only — engine otherwise untouched).
- **Specs**: new `ui-navigation` and `pso-visual-theme`; delta on `character-roster`.
- **No impact**: simulation determinism, save format/version, `StoragePort`, combat math, battle stage internals (`stage.ts`, `scene.ts`).
