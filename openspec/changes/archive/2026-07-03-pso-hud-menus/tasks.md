## 1. Chrome & layout foundation

- [x] 1.1 Rework window chrome in `styles.css`: organic asymmetric-radius silhouette replacing the clipped corner (retire `--corner` clip-path and the facet pseudo), keep scanline/glow tokens; add `.pso-tab` orange tab-header element style with trailing-content slot
- [x] 1.2 Build the HUD layout: fixed `.scene` + `.hud` layers, named-area grid (status cluster / money pod / nav / pane / detail / dialogue), window `max-height` + internal scrolling, breakpoints at ~1100px (detail reflows under pane) and ~900px (vertical stack, page scroll allowed)
- [x] 1.3 Restructure `hubScreen()` in `views.ts` to emit the HUD regions; split the hub DOM into a persistent layer host (scene, dialogue timer) and the re-rendered windows container
- [x] 1.4 Replace the status bar with the status cluster (hex level chip, name plate, XP-to-next thin bar, class/section small print) and the top-right money pod; remove hub usage of `.topbar`

## 2. Scene backdrop

- [x] 2.1 Create `src/ui/backdrop.ts`: canvas glyph-wall renderer (falling/flickering teal glyphs, gradient floor, vignette), 12fps cap, `document.hidden` pause, `prefers-reduced-motion` static frame, local xorshift (no `Math.random`)
- [x] 2.2 Add per-pane backdrop themes (tint, glyph density, motif silhouette per shop/guild/bank/equipment) with crossfade on pane switch
- [x] 2.3 Mount the backdrop as a persistent sibling of the windows container; verify re-renders (buy/sell/select) never restart it

## 3. Menus, icons, and density

- [x] 3.1 Add the inline SVG glyph sprite (saber, frame, barrier, unit, mate, atomizer, grinder, meseta) and an `icon(kind)` helper; prepend glyphs to all item rows with `currentColor` tinting
- [x] 3.2 Apply PSO-density row styles: ~24px visual rows, ≥28px hit areas, right-aligned tabular-numeral prices/quantities, equipped-green + marker treatment; relax density under 900px
- [x] 3.3 Animate the orange selection bar sliding between rows (transform transition, disabled under reduced motion)
- [x] 3.4 Add tab headers to each named window (nav "Pioneer 2", shop stock with count, detail, guild counter, bank with capacity), moving titles out of `<h2>`/`<h3>` body headings

## 4. Dialogue system

- [x] 4.1 Create `src/ui/dialogue.ts`: per-pane greeting pools, prompt lines, reaction lines (bought, sold, insufficient meseta, sold-out, equip, quest accepted), cycling-index selection; item `flavor()` table with kind-level fallbacks
- [x] 4.2 Render the bottom dialogue window with typewriter reveal, instant-complete on click/keypress, and cancel-on-new-line; greeting fires once per pane visit (flag reset on pane change only)
- [x] 4.3 Wire action outcomes in `onAction()` to reaction lines; route shop/bank/guild/equip failure reasons through the dialogue voice instead of the `.notice` line (keep `.notice` for non-dialogue screens)
- [x] 4.4 Lead item detail views with the flavor line, demoting the `itemMeta()` stat string to secondary small print

## 5. Guild counter redesign

- [x] 5.1 Replace the area `<select>` with a PSO menu list (name + rec. ATP meta, orange bar selection)
- [x] 5.2 Replace difficulty and attack pattern `<select>`s with selectable chip rows (hex difficulty chips, pattern chips with N-N-H meta)
- [x] 5.3 Move loot filter + supply summary into a subordinate "Counter Settings" window; keep Accept Quest as the hex primary with a dialogue prompt line

## 6. Keyboard navigation

- [x] 6.1 Implement the roving-highlight keyboard helper in `views.ts`: Up/Down within the focused menu, Enter activates, Escape steps back (candidates→slots, pane→nav), digit keys jump to nav entries (ignored while a text input is focused)
- [x] 6.2 Ensure the orange bar doubles as the focus indicator and pointer-only operation still reaches everything

## 7. Verification & polish

- [x] 7.1 Run the app across widths (≥1400px, ~1000px, <900px): scene visible at wide widths, no page scroll on desktop, no horizontal scroll anywhere, collapse behavior correct
- [x] 7.2 Verify run screen and battle stage are unaffected (HP bar contract, stage-owned DOM) and character select/create still render correctly under the new chrome
- [x] 7.3 Check readability/contrast of muted text over the busy scene (raise window fill alpha if needed) and confirm the no-`Math.random` test passes with the backdrop in place
- [x] 7.4 Run existing test suite and typecheck; fix regressions
