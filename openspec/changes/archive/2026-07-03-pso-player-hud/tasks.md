## 1. Section ID glyphs

- [x] 1.1 Add ten section ID SVG `<symbol>`s (`sid-viridia` … `sid-whitill`) to `src/ui/icons.ts` in canonical colors, extending the `IconId` union; add a `sectionIcon(sectionId)` helper mapping `SECTION_IDS` names to icon ids
- [x] 1.2 Sanity-render all ten glyphs (temporary page or the create screen) and eyeball legibility at ~14px; refine shapes as needed

## 2. PlayerHud component

- [ ] 2.1 Add `PlayerHud` component to `src/ui/components.tsx`: capsule root (`player-hud` class) with hex icon + PB badge (`0`), HP row (fill element `stage-char-hp`, text element `stage-char-hp-text`), TP row at `0/0`, `Lv N` pill, section glyph + yellow name; values via props/accessors
- [ ] 2.2 Add capsule CSS in `styles.css`: capsule outline, hex clip-path with badge, HP/TP bar rows with right-aligned numbers, Lv pill, yellow name plate; port the `hurt`/`healed` flash styles from `stage-player-box` to `.player-hud`

## 3. Hub integration

- [x] 3.1 Replace `StatusCluster` in `hub.tsx` with `PlayerHud` (HP shown `max/max` from `effectiveStats`) plus the new XP/economy side panel window (total XP, XP-to-next bar reusing `xp-bar`, meseta, grinders)
- [x] 3.2 Remove `MoneyPod` and the `hud-money` grid area; update the `hud` grid template and delete the now-unused `status-cluster`/`money-pod` CSS
- [x] 3.3 Verify hub keyboard navigation and all panes are unaffected (capsule/side panel are non-interactive)

## 4. Run screen integration

- [x] 4.1 In `islands.tsx`, render `PlayerHud` top-left of the run screen (same anchor as hub) and remove the `stage-player-box` block; move the room label into the `stage-bottom` strip next to the supply readout; drop the run topbar meseta readout
- [x] 4.2 Update `stage.ts` flash selectors from `.stage-player-box` to `.player-hud` and the room-label update to its new location; delete `stage-player-box` CSS
- [x] 4.3 Run `tests/stage.test.ts` and fix any selector fallout (HP hooks unchanged by design)

## 5. Verify

- [x] 5.1 Full test suite + typecheck pass
- [x] 5.2 Drive the app with the `verify` skill: screenshot hub (capsule + side panel, no money pod) and an active run (capsule top-left, live HP, hurt/heal flashes) and compare against the reference screenshot
