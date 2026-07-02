## 1. Engine: unlimited roster

- [x] 1.1 Remove `ROSTER_CAP` and its check in `Game.createCharacter` (`src/engine/game.ts`); update/remove any test asserting the cap and add a test that creating a 5th+ character succeeds

## 2. PSO visual theme (CSS foundation)

- [x] 2.1 Copy `assets_to_ingest/GULIM.TTC` to `src/ui/assets/gulim.ttc`; add `@font-face` with `font-display: swap`, fallback stack, and a licensing note comment
- [x] 2.2 Rewrite `styles.css` token layer: PSO palette custom properties (window fill, cyan edge, orange selection, HP green, TP blue, gold, rarity colors), remove `#app` max-width, padding-gutter layout
- [x] 2.3 Build `.pso-window` (translucent teal fill, scanline gradient, cyan border + glow, clipped corner via `clip-path`) and flat inner-panel variant; apply to existing panel markup
- [x] 2.4 Build `.pso-menu` rows with orange hover/selected bar, `.pso-btn` and primary-action (hex `clip-path`) button styles; restyle `.hpbar` to BB green-on-bezel without changing its class/element contract

## 3. Screen router

- [x] 3.1 Add `screen` state and dispatch to `UI.render()` in `views.ts`: preserve the `activeRun`/BattleStage branch verbatim; route non-run rendering to per-screen methods; add `goto` action handling
- [x] 3.2 On run settle, force `screen = "hub"` before painting (settle detection via the existing `main.ts` poll/render path — no `main.ts` changes expected)

## 4. Character select & create screens

- [x] 4.1 Character select screen: card grid of roster entries (name/class/level/section ID) + empty-slot card; card click selects and enters hub; delete control with confirm on each card
- [x] 4.2 Character create screen: class list with orange selection and base-stat preview pane, then name input with live derived section ID; section-ID override behind a disclosure; create → select → hub

## 5. Pioneer 2 hub

- [x] 5.1 Hub layout: three-column grid (character+equipment / Hunter's Guild counter / counter directory) collapsing to one column under ~900px
- [x] 5.2 Left column: character identity, stats, equipment rows with equip/unequip/grind actions (ported from prep screen)
- [x] 5.3 Center column: Hunter's Guild counter — area/difficulty/pattern selects, loot filter, supply summary, "Accept Quest" primary action wired to `sendRun`
- [x] 5.4 Right column: counter directory buttons (Weapon & Armor Shop, Tool Shop, Bank) + "Change character"; remove the old roster panel entirely
- [x] 5.5 Post-run report as dismissible PSO dialog on the hub (dismissal UI-local; report state untouched)

## 6. Shop & bank sub-screens

- [x] 6.1 Shared list+detail sub-screen shape: menu list pane with highlight bar, detail pane for the highlighted entry, "Leave" back to hub
- [x] 6.2 Weapon & Armor Shop: `shopStock()` offers with prices and buy actions; detail pane shows item stats (optional: comparison vs equipped)
- [x] 6.3 Tool Shop: consumables + grinders with buy 1/10 actions
- [x] 6.4 Bank: shared inventory with equip/sell actions and item detail

## 7. Verification & polish

- [x] 7.1 Run the full test suite and typecheck; verify no `src/engine` behavior change beyond the cap removal (determinism tests still pass)
- [x] 7.2 Manual pass with `/verify`-style walkthrough: boot → select → create → hub → each shop → accept quest → run view renders → settle → report dialog on hub; check narrow-viewport collapse and font fallback
