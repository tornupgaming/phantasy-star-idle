## Context

The hub's top-left status cluster (`hub.tsx` `StatusCluster`: hex level chip, name, class · section text, XP bar) and top-right money pod are bespoke layouts. The run screen shows the player as a `stage-player-box` at the *bottom* of the stage panel (`islands.tsx`), driven imperatively by `BattleStage` through class hooks (`.stage-char-hp` width, `.stage-char-hp-text` text, `hurt`/`healed` flash classes on the box). Reference: the original PSO HUD unit — one cyan-outlined capsule with a hex character icon half-overlapping the left edge carrying a Photon Blast badge number, HP and TP bars with right-aligned `cur/max`, a `Lv N` pill off the bottom-left, and the character name in yellow.

Constraints: the run shell is rendered once and updated imperatively (no reactivity in `stage.ts`); the hub is reactive Solid. There is no TP stat and no Photon Blast system in the engine. Icons live as SVG `<symbol>`s in `icons.ts` referenced via `<use>` (`Icon` in `components.tsx`).

## Goals / Non-Goals

**Goals:**
- One `PlayerHud` component whose markup and class hooks serve both regimes: Solid fills values in the hub; `BattleStage` drives HP imperatively in the run.
- Faithful capsule anatomy: hex + PB badge (`0`, no radial fill), HP bar, TP bar at `0/0`, Lv pill, section-ID glyph + yellow name.
- Ten section ID SVG glyphs in canonical colors, added to the existing sprite system.
- Hub: capsule + adjacent XP/economy side panel replace status cluster and money pod.
- Run screen: capsule anchored top-left (same place as hub) with a modest reflow.

**Non-Goals:**
- No TP/techniques or Photon Blast mechanics — the TP row and PB badge are static authentic-empty placeholders.
- No full HUD-over-scene run-screen restructure (full-bleed enemy field, corner windows) — deferred to a later change.
- No engine or save changes; no changes to select/create screens (section glyphs are merely made available).

## Decisions

**D1 — `PlayerHud` is a shared Solid component with imperative-friendly hooks.** New `PlayerHud` (in `components.tsx`, alongside `WindowBox`) renders the capsule markup. Its HP fill and HP text elements keep the existing hook classes `stage-char-hp` / `stage-char-hp-text`, and the capsule root carries class `player-hud`. In the hub it renders reactive values (`hp = effectiveStats(char).hp`, shown full: `max/max`). In the run shell (`StageIsland`) values are read once at mount per the existing static-shell design; `BattleStage` then owns the HP elements exactly as today. Alternative considered: separate hub/run markups sharing only CSS — rejected, drift risk defeats the point of unifying them.

**D2 — Stage flash/selector updates target the capsule root.** `stage.ts` selectors for the flash effects change from `.stage-player-box` to `.player-hud`; the inner HP hooks are unchanged, so `tests/stage.test.ts`'s `.stage-char-hp-text` assertions keep passing. The room label (`.stage-room-label`), currently in the player box header, moves to the `stage-bottom` strip next to the supply readout — it is run-telemetry, not player identity, and doesn't belong in the capsule.

**D3 — TP row and PB badge are the authentic empty states, not fakes.** TP renders as a real bar element with 0% fill and literal text `0/0`; the PB badge is a literal `0` with no radial fill. A character before these systems exist is visually identical to a character with empty gauges, so nothing needs ripping out when techniques/PB land — the numbers just start moving. The markup reserves the badge element and bar structure those features will drive.

**D4 — Section ID glyphs are hand-authored SVG symbols in `icons.ts`.** Ten new sprite ids (`sid-viridia` … `sid-whitill`, keyed off `SECTION_IDS` in `engine/classes.ts`) drawn as small geometric vector approximations of the original symbols, each in its canonical color (Viridia green, Greenill yellow-green, Skyly sky blue, Bluefull blue, Purplenum purple, Pinkal pink, Redria red, Oran orange, Yellowboze yellow, Whitill white). Rendered beside the name via the existing `Icon` component. Alternative: raster rips from game assets — rejected (licensing, and the project's chrome is deliberately CSS/SVG-only per pso-visual-theme).

**D5 — Side panel is a plain `pso-window`, hub-only.** A small window next to the capsule showing total XP, XP-to-next with the thin progress bar (reusing the `xp-bar` styling), meseta, and grinders — absorbing both the old cluster's XP readout and the money pod. `MoneyPod` and its `hud-money` grid area are removed; the `hud` grid template updates accordingly. It stays hub-only because XP/meseta only settle when a run ends, so on the run screen it would sit stale; the capsule alone also matches what PSO shows in the field. Class name is dropped from the HUD entirely (still visible on select/equipment screens).

**D6 — Run-screen reflow is minimal.** The capsule renders top-left as the first element of the run screen, replacing the current topbar's title block position (the meseta readout in the run topbar goes away with the money-pod concept; the report shows earnings at settle). `stage-player-box` markup and styles are deleted; `stage-bottom` keeps supply + room label. Everything else (progress panel, stage, log) stays stacked as-is.

## Risks / Trade-offs

- [Hub renders stale HP if damage ever persists across runs] → Today HP is always full outside a run (`effectiveStats` max); if persistent HP is ever added, the hub capsule reads it from the same accessor — the component takes values as props, not a hardcoded `max/max`.
- [Two update regimes touching one component] → Mitigated by a strict split: Solid only ever writes via props at mount/reactively; the stage only ever writes to the designated hook elements. No element is written by both in the same regime.
- [Hand-drawn section glyphs read as off-brand] → They're 12–16px at name-plate size; simple geometric approximations in the right colors carry the recognition. Can be refined per-glyph later without structural change.
- [Keyboard navigation regressions in the hub] → The capsule and side panel are non-interactive (no `.pso-menu`), so the `kbdMenu` document listener and menu discovery are unaffected; only the grid template changes.

## Open Questions

- Exact glyph geometry for the ten section symbols — to be judged visually during implementation (the `verify` skill's screenshots are the review tool).
