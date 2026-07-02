## Context

The UI layer (`src/ui/*`) is a thin vanilla-DOM renderer over the `Game` engine. Today `UI.render()` is a two-way branch: `activeRun ? runShell (BattleStage) : prepScreen`, where the prep screen is one HTML string containing character sheet, roster management, dispatch, inventory, and shop in a 2-column grid capped at 980px. The engine already exposes everything the new flow needs (`roster`, `selectedCharacterId`, `createCharacter`, `selectCharacter`, `deleteCharacter`, `shopStock`, `sendRun`, `lastReport`); the sole engine-side obstacle is `ROSTER_CAP = 4` in `game.ts`.

Reference material: `assets_to_ingest/181631.png` (PSO BB UI spritesheet rip — visual reference), `assets_to_ingest/GULIM.TTC` (the BB UI font), and https://ephinea.pioneer2.net/beginners-guide/creating-a-character/ for the authentic creation order.

## Goals / Non-Goals

**Goals:**
- Screen-router navigation: character select → (create) → Pioneer 2 hub → shop/bank sub-screens; run view overrides all.
- PSO BB visual language recreated in pure CSS with design tokens; sharp at any size and width.
- Full-width layouts that use horizontal space (three-column hub, list+detail shops).
- Unlimited roster.

**Non-Goals:**
- No run-view restructuring (`stage.ts` / `scene.ts` untouched; it just inherits global styling).
- No appearance customization in character create (no character model exists).
- No load-bearing spritesheet slicing (no 9-slice `border-image` chrome).
- No engine/simulation changes beyond deleting the roster cap; no save shape change, no `SAVE_VERSION` bump.
- No persistence of UI screen state (reload lands on character select — authentic BB behavior).

## Decisions

### D1 — Screen router as UI-only state
`UI` gains `private screen: Screen` where `Screen = "select" | "create" | "hub" | "shop-gear" | "shop-tool" | "bank"`. `render()` dispatches: if `activeRun`, mount the BattleStage exactly as today (its mount/teardown logic is preserved verbatim); otherwise render `this.screen`. Navigation actions (`data-action="goto"` with a `data-screen`) just set the field and re-render. Not persisted; initial value `"select"`.
*Alternative considered*: hash-based routing (`#/hub`) — rejected as needless surface for a single-page idle game, and it would fight the "boot to character select" rule.

### D2 — Settle forces the hub
When a run settles (`game.poll()` returns true / `activeRun` clears), `render()` sets `screen = "hub"` before painting, and the existing `lastReport` renders as a PSO-style dialog window on the hub. This mirrors returning to Pioneer 2 after a quest and guarantees the report is never orphaned on a shop screen. The report dialog is dismissible (existing report stays in state until the next run, as today; dismissal is UI-local).

### D3 — Screen decomposition of the old prep screen
- **Character select**: card grid (auto-fill, ~240px min column) of roster entries — name, class, level, section ID — plus a trailing "— Empty Slot —" card. Card click = `selectCharacter` + goto hub. Delete lives here (small control on each card, existing confirm dialog), not on the hub.
- **Character create**: PSO BB order — class list first (12 classes, orange selection bar, base-stat preview pane on the right), then name input with live derived section ID; explicit section-ID override behind a disclosure ("Change section ID"), defaulting to derived. Create → auto-select → hub.
- **Hub (Pioneer 2)**: three columns — left: character identity + stats + equipment (equip/unequip/grind actions as today); center: Hunter's Guild counter = area/difficulty/pattern/supply/loot-filter + "Accept Quest" (= `sendRun`), and the post-run report dialog; right: counter directory — three large PSO-window buttons (Weapon & Armor Shop, Tool Shop, Bank) plus "Change character" (goto select).
- **Shop/bank sub-screens**: shared list+detail shape. Left pane: PSO menu list with orange selection bar; right pane: detail of the highlighted entry (stats, and for gear a comparison against the selected character's equipped item). Actions: buy (shops), equip/sell (bank). Each has a "Leave" control back to hub. Gear shop = `shopStock()`; tool shop = consumables + grinders; bank = shared inventory.
*Alternative considered*: shops as modal overlays on the hub — rejected; user explicitly wants distinct destinations behind clicks, and full-screen views give the list+detail layout room.

### D4 — PSO theme as CSS tokens, no sprites
`styles.css` is rewritten around custom properties: `--pso-window` (dark teal fill, ~80% opacity), `--pso-edge` (cyan), `--pso-select` (orange), `--pso-hp` (green), `--pso-tp` (blue), plus the existing rarity/gold tokens re-tuned to the BB palette. Reusable classes:
- `.pso-window`: translucent teal panel, 1px cyan border with outer glow, one clipped corner via `clip-path: polygon(...)`, scanline fill via `repeating-linear-gradient`.
- `.pso-menu` rows with `:hover`/selected orange bar; `.pso-btn` (rectangular) and `.pso-hexbtn` (hexagonal `clip-path`) buttons.
- Bars keep the existing `.hpbar` contract (BattleStage sets widths by class name) restyled to BB chunky-bezel green.
The spritesheet is reference-only. *Alternative considered*: 9-slice `border-image` from the rip — rejected per user decision ("CSS recreated so it's sharp"); fixed-size sprites fight full-width layouts.

### D5 — Typography
`@font-face` for GULIM.TTC copied to `src/ui/assets/gulim.ttc`, `font-display: swap`, fallback stack `"Gulim", "Segoe UI", system-ui, sans-serif`. Licensing: Gulim and the spritesheet are not redistributable; acceptable for this personal project, flagged in a CSS comment at the `@font-face` site.

### D6 — Full width
`#app` max-width removed; content padding-based gutters instead. Hub uses `grid-template-columns: minmax(280px, 1fr) minmax(360px, 1.4fr) minmax(280px, 1fr)` collapsing to one column under ~900px. Run view inherits full width unchanged; any awkwardness there is accepted and deferred.

### D7 — Roster cap removal
Delete `ROSTER_CAP` and its check in `Game.createCharacter` (`game.ts:291-292`). Roster is already an array in the save; no migration. The character-select grid scrolls, so unbounded rosters have a natural home. Delta spec removes the cap requirement/scenario from `character-roster`.

## Risks / Trade-offs

- [BattleStage regression: `render()` restructure could break the mount-once/no-rebuild contract] → Keep the `activeRun` branch and stage lifecycle code byte-for-byte at the top of `render()`; only the non-run branch changes.
- [Old tests or scripts referencing `ROSTER_CAP`] → grep for the symbol; update the roster-cap test to assert unbounded creation instead.
- [Gulim renders differently across platforms / fails to load] → fallback stack keeps layout stable; no metrics-dependent layout (no fixed-height text boxes).
- [Clipped-corner + glow CSS can look cheap if overused] → apply the full `.pso-window` treatment to top-level windows only; inner items use flat variants.
- [More screens = more clicks for a game played in short frequent sessions] → hub keeps the highest-frequency actions (equip, dispatch) zero-clicks-deep; only shopping/banking is behind a click, matching their lower frequency.
- [Asset licensing] → reference-only spritesheet; font shipped locally, flagged; nothing blocks a later swap to a free Gulim-alike.

## Migration Plan

Pure client change. Ship in one piece; rollback = revert. Saves are untouched (cap removal only loosens validation). On first load after the change, users land on character select with their existing roster — no data action required.

## Open Questions

- Hex-button usage: which actions earn the hexagonal treatment vs plain rectangles (suggest: primary per-screen action only — Accept Quest, Create). Decide during implementation by eye.
- Whether the gear-shop detail pane's "vs equipped" comparison ships in v1 or as fast-follow (cheap to add: `effectiveStats` already exposed).
