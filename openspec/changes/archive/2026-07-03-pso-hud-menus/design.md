# Design: pso-hud-menus

## Context

The hub is a document-flow dashboard: `.topbar` + full-width `.status-bar` panel + a sidebar/detail grid (`views.ts` `hubScreen()`, `styles.css` `.hub-shell`). The PSO references it homages are HUDs: small dense windows anchored to screen corners over a live scene, orange tab headers, item icons, dialogue windows with a shopkeeper voice. The re-skin (pso-visual-theme) got the palette right but kept the dashboard skeleton, so wide viewports produce huge empty teal rectangles.

Constraints: UI stays a thin vanilla-DOM layer (no game logic, no framework); the engine and save shape are untouched; the run screen's BattleStage contract (stage-owned DOM, HP bar class names) must survive; responsive fullscreen is a hard requirement — no fixed-aspect letterboxing.

## Goals / Non-Goals

**Goals:**
- Hub feels like a place: animated scene behind floating, corner-anchored windows.
- PSO window language: orange tab headers, organic silhouettes, status cluster, dense icon rows.
- Personality: shopkeeper dialogue with greetings, prompts, and reactions.
- Better UX than today, not just prettier: keyboard navigation, fewer clicks on the guild counter, content scrolls inside windows (the page itself never scrolls on desktop).

**Non-Goals:**
- Run screen / battle stage restructure (inherits chrome tokens only).
- Character select/create restructure (inherit window chrome; layout unchanged this change).
- Audio, gamepad support, engine or save changes.

## Decisions

### D1: HUD layout = full-viewport layers + named-area grid
`#app` becomes two fixed layers: a `.scene` layer (z: 0) filling the viewport, and a `.hud` layer (z: 1) that is a CSS grid with named areas anchored to screen regions:

```
┌────────────────────────────────────────────────┐
│ [status cluster]                    [money pod]│  top edge
│ [nav window]   ┌─TAB══════════════┐            │
│  Pioneer 2     │   active pane    │ [detail /  │
│  menu rows     │   window(s)      │  preview]  │
│                └──────────────────┘            │
│ [dialogue window — shopkeeper line]            │  bottom edge
└────────────────────────────────────────────────┘
```

Windows are grid items with `align-self`/`justify-self` toward their anchor edge and `max-height` constraints; long lists scroll inside the window (`overflow:auto`), never the page. The grid tracks are `minmax()`-based so the composition breathes at any width instead of stretching panels — empty space shows *scene*, which is the point. Breakpoints: below ~1100px the detail column drops under the pane window; below ~900px the HUD becomes a vertical stack (scene still behind) and the page may scroll.

*Alternative considered:* per-window `position:absolute` anchoring (closer to literal PSO) — rejected as brittle across viewport sizes and overlap-prone; the grid gives the same corner-anchored look with real responsive behavior.

### D2: Scene layer is a persistent canvas glyph-wall with per-pane themes
New `src/ui/backdrop.ts`: one `<canvas>` rendering the Guards-Shop-style wall of falling/flickering teal glyphs (katakana-ish shapes + hex digits), low fps (~12), plus CSS gradient floor/vignette. Each pane declares a backdrop theme: tint, glyph density, and a motif silhouette (guild: quest-board arrows; weapon shop: crossed sabers; tool shop: flask; bank: vault ring) drawn as a large faint shape. Pane switches crossfade the theme rather than remount the canvas.

The canvas mounts **outside** the re-rendered root (sibling layer, like BattleStage's ownership model) so `render()`'s `innerHTML` rebuilds never restart the animation. `prefers-reduced-motion` renders a single static frame. The canvas pauses on `document.hidden`.

**RNG note:** the repo enforces no ad-hoc `Math.random` (CLAUDE.md). Whether the test covers `src/ui` or only `src/engine`, the backdrop will use a tiny local xorshift seeded from a constant — it's visual-only, needs no determinism guarantee, and keeps the test unambiguous.

### D3: Window anatomy v2 — tab caps, organic silhouettes, status cluster
- **Tab header:** every named window gets an orange gradient tab (`.pso-tab`) overlapping its top edge (negative margin), white text with subtle glow — the "Item List"/"Tools Shop" motif. Implemented as a real element, not a pseudo, so it can hold counts (`13/30`) and pagination.
- **Silhouette:** replace the single clipped corner with asymmetric rounded corners (one large sweep, e.g. `border-radius: 4px 22px 4px 12px`) + the existing scanline/glow tokens. The clipped-corner facet is retired (it's rarer in the references than assumed).
- **Status cluster:** the full-width status bar becomes a top-left cluster: hexagonal level chip (clip-path) fused to a curved name plate, HP-style bars beneath (XP-to-next rendered as a thin bar — same visual grammar as HP/TP), with class/section ID small print. Meseta + grinders live in a separate small "money pod" (top-right), like BB's money pill. All existing status content requirements are preserved, just re-homed.

### D4: Navigation — floating nav window + keyboard model
The sidebar becomes a compact "Pioneer 2" nav window (top-left, under the status cluster) using the existing `.pso-menu-row` orange-bar rows. New interaction layer:

- **Keyboard:** ↑/↓ move the highlight in the focused menu, Enter activates, Esc backs out (candidate → slot, detail → list, pane → nav), `1`–`7` jump straight to a nav entry. One shared roving-highlight helper in `views.ts`; the orange bar *is* the focus indicator.
- **Selection bar motion:** the orange bar animates (~80ms slide) between rows via a `transform` transition — cheap flair that makes the menu feel mechanical/console-like.
- Hover still works everywhere; keyboard is additive, not required.

### D5: Dialogue system — data-driven lines with a typewriter window
New `src/ui/dialogue.ts`: a plain data module mapping pane → greeting pool, prompt lines per mode, and reaction lines for outcomes (bought, sold, insufficient meseta, sold-out, equip). The bottom dialogue window renders the current line with a CSS-stepped typewriter reveal; clicking it (or any keypress) completes the line instantly. Greetings fire once per pane visit (a per-pane `greeted` flag, reset on pane change, so re-renders from purchases don't re-greet — reactions replace the line instead: "A fine choice!" / "You're short on meseta."). Line selection cycles through the pool (index counter, no RNG needed).

Item flavor: a `flavor()` helper produces a one-line description per item kind/known-name (hand-written table with kind-level fallbacks), shown in the detail window above the stat block — replacing the bare `itemMeta()` string as the lead line (the stat string remains, demoted to small print).

### D6: Item icons — inline SVG glyph sprite
One inline `<svg><symbol>` sprite (saber, frame, barrier, unit chip, mate flask, atomizer, grinder, meseta) referenced via `<use>`, sized ~14px, tinted by `currentColor` so rarity/equipped colors apply automatically. Rows get PSO density: ~24px visual height, quantity/price right-aligned in tabular numerals, equipped items in HP-green with an `E` marker.

*Alternative considered:* pixel-art PNG glyphs matching the enemy-art pipeline — rejected for list use; at 12–14px SVG stays crisp at every DPI and inherits semantic colors for free.

### D7: Guild counter — menu rows and chips, no form controls
- **Area:** a PSO menu list (name + `rec. ATP` meta), the selected row carrying the orange bar — replaces the `<select>`.
- **Difficulty:** four hex chips (Normal/Hard/V.Hard/Ultimate) in a row, selected chip lit cyan.
- **Attack pattern:** the preset names as chips with the pattern (`N-N-H`) as meta.
- **Loot filter + supply:** demoted into a small secondary window ("Counter Settings") with the same controls it has today.
- **Accept Quest:** the existing hex primary button, full-width in the guild window, with the dialogue window prompting ("Which quest will you take?").

This removes every raw form control from the guild pane except the numeric auto-sell threshold.

### D8: Rendering model unchanged, ownership split clarified
Keep the `innerHTML`-rebuild + `bind()` model for windows. Two persistent siblings escape it: the backdrop canvas (D2) and the dialogue typewriter timer (cancelled/restarted on line change). No virtual DOM, no framework — this stays a thin presentation layer per CLAUDE.md.

## Risks / Trade-offs

- [Canvas animation cost on low-end machines] → 12fps cap, pause on `document.hidden`, static frame under `prefers-reduced-motion`; glyph count scales with viewport area but is clamped.
- [Dense rows hurt touch/click targets] → visual density comes from typography and tight padding, but hit areas keep ≥28px via row padding; narrow-viewport breakpoint relaxes density.
- [Orange-on-teal contrast / readability] → tab text is white-on-orange (as in BB), selection ink stays the existing dark `--pso-select-ink`; verify AA contrast for muted text over the busier scene by keeping windows' translucent fill dark enough (raise fill alpha if needed).
- [Typewriter effect becomes annoying] → fires only on pane entry, instant-complete on any input, and reactions swap the line without re-typing the greeting.
- [HUD grid degrades into overlap at odd sizes] → windows have `min()`-based widths and the grid collapses in two steps (1100px, 900px); page-level vertical scroll is the final fallback, horizontal scroll never allowed.
- [Spec churn: full-width three-column requirement contradicts HUD] → explicitly replaced via delta spec (BREAKING at spec level, no user data impact).

## Open Questions

- Flavor-text coverage: kind-level fallbacks ship first; per-item lines for rares can grow over time — is a starter set of ~15 hand-written lines enough for v1? (Assumed yes.)
- Whether character select/create later adopt the scene layer too — deliberately deferred, but the backdrop module is written pane-agnostic so they can.
