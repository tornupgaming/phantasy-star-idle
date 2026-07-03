## Why

The hub's status cluster and the run screen's player box are ad-hoc layouts that don't match the game's PSO Blue Burst visual language. The original PSO HUD unit (hex character icon with Photon Blast badge, HP/TP bars, Lv pill, yellow character name) is instantly recognizable and carries exactly the information we want front-and-center; adopting it unifies the hub and run screens around one authentic component and pre-stages the UI for a future techniques (TP) and Photon Blast system.

## What Changes

- New shared `PlayerHud` capsule component styled after the original PSO HUD unit: a single cyan-outlined capsule containing a hex character icon half-overlapping the left edge with a Photon Blast badge (rendered as `0` with no radial fill — the authentic empty-gauge state — until a PB system exists), an HP bar with `cur/max` numbers, a TP bar rendered `0/0` (no TP system yet; placeholder for future techniques), a `Lv N` pill hanging off the bottom-left, and the character name in yellow with a section ID glyph beside it.
- New section ID iconography: the ten PSO section ID symbols as inline SVG glyphs in their canonical colors, registered in the existing icon/sprite system; used in the capsule name plate (and available to the create/select screens later).
- Hub top-left: the current status cluster (name, class, section text, level chip, XP bar) is **replaced** by the capsule plus an adjacent side panel showing XP (total + to-next progress), meseta, and grinders. The top-right money pod is **removed**; its content moves into the side panel.
- Run screen: the capsule appears top-left (same anchor as the hub), replacing the `stage-player-box` currently at the bottom of the stage panel. The `BattleStage` keeps driving live HP via the existing imperative class hooks. The side panel stays hub-only (XP/meseta don't accrue mid-run). Modest reflow of the run screen to accommodate; the full HUD-over-scene run-screen restructure is deferred to a later change.
- Class name disappears from the always-visible HUD (still visible on select/equipment screens).

## Capabilities

### New Capabilities
- `player-hud`: the PSO-authentic player HUD capsule (hex icon + PB badge, HP/TP bars, Lv pill, section-glyph + name) shared between hub and run screens, plus the section ID glyph set.

### Modified Capabilities
- `ui-navigation`: the "Hub status bar" requirement changes — status cluster and money pod are replaced by the PlayerHud capsule + XP/economy side panel; the run view now also shows the capsule (previously excluded).
- `battle-scene-view`: the "Classic battle stage layout" requirement changes — the player status window moves from the bottom of the stage to the top-left PlayerHud capsule while keeping the imperative HP-update contract.

## Impact

- `src/ui/hub.tsx` — `StatusCluster` and `MoneyPod` removed/replaced; new side panel.
- `src/ui/islands.tsx` — run-screen shell reflow; `stage-player-box` replaced by the capsule markup.
- `src/ui/stage.ts` — player HP hook selectors updated if class names change (contract preserved).
- New `PlayerHud` component (likely `src/ui/components.tsx` or its own file) and section ID SVGs in `src/ui/icons.ts`.
- `src/ui/styles.css` — capsule, bars, pill, badge, side panel styles; removal of status-cluster/money-pod styles.
- No engine changes, no save-shape changes. Tests touching the hub/run DOM (if any) may need selector updates.
