# Design — Convert menu-regime UI to SolidJS

## Context

The UI has two rendering regimes (see `src/ui/views.ts`):

- **Menu regime** (select / create / hub): the `UI` class re-renders whole screens
  with `innerHTML`, then re-attaches listeners (`bind()`), the dialogue typewriter
  (`paintDialogue()`), and keyboard focus (`paintKbd()`) after every paint. About
  ten private fields exist purely so state survives these re-renders.
- **Run regime**: `BattleStage` (`src/ui/stage.ts`) is mounted once and drives all
  updates imperatively from a `requestAnimationFrame` loop — event playback at
  timestamps, float glyphs removed on `animationend`, HP tweens, silent catch-up
  folds after tab throttling. `Backdrop` (`src/ui/backdrop.ts`) is a persistent
  canvas animation. Both are event players, not views of state.

The engine (`src/engine/*`) is pure and mutation-based; `game.poll()` mutates
`game.state` in place on a 1 Hz interval in `src/main.ts`. Replay determinism and
the seeded-RNG rule are hard constraints. Existing UI capability specs
(ui-navigation, shop-dialogue, hub-scene-backdrop, battle-scene-view,
pso-visual-theme, item-iconography) define the acceptance bar.

## Goals / Non-Goals

**Goals:**
- Menu screens as Solid components with fine-grained updates: interactions no
  longer destroy and rebuild the DOM around them.
- Transient UI state (dialogue reveal progress, keyboard focus, selections,
  create-screen draft) held in signals so it survives by construction.
- Engine stays 100 % Solid-ignorant; one-way state bridge at the UI boundary.
- BattleStage and Backdrop internals untouched, mounted as imperative islands.
- All existing UI spec scenarios keep passing; no visual/behavioral change.

**Non-Goals:**
- Converting BattleStage or Backdrop to reactive rendering (including the stage
  shell — it stays part of the island for now).
- Any engine change, save-format change, or spec-behavior change.
- Styling changes (`styles.css` classes are reused by the TSX as-is).
- Performance optimization beyond what fine-grained updates give for free.

## Decisions

### D1: SolidJS with TSX, via `vite-plugin-solid`
`solid-js` + `vite-plugin-solid`; `tsconfig` gets `"jsx": "preserve"`,
`"jsxImportSource": "solid-js"`. Screens become `.tsx` files under `src/ui/`.
*Alternative considered*: Solid's `html` tagged-template (no build change) —
rejected: loses TypeScript checking of props/JSX, and the Vite plugin is the
idiomatic, well-trodden path.

### D2: Engine bridge = `createStore` + `reconcile` snapshots
A `createGameStore(game)` wrapper owns a Solid store initialized from
`game.state`. Every pathway that mutates engine state — user actions (each
`game.*` call site) and the 1 Hz poll — calls a single `sync()` that runs
`setStore(reconcile(snapshot(game.state)))`. Components read only from the
store; actions call `game.*` then `sync()`.
- `reconcile` diffs structurally, so unchanged panes don't re-render — this is
  what buys "buying an item doesn't rebuild the shop".
- The snapshot is a structural clone (`structuredClone` or JSON round-trip) so
  the store never aliases engine-mutated objects; at this state size and 1 Hz
  cadence the cost is negligible.
*Alternative considered*: a single version-counter signal with untracked reads
of `game.state` — rejected: coarse (whole-screen recompute, same as today),
and aliasing live mutable engine objects into JSX invites stale-read bugs.

### D3: Regime split — Solid router hosts imperative islands
A single `<App>` component owns the top-level regime switch (`activeRun` present
→ run regime; else menu regime) and the screen router (select / create / hub).
- `<StageIsland>` renders the static run-shell markup once and, in `onMount`,
  constructs `new BattleStage(el, game)` / `.start()`; `onCleanup` calls
  `.stop()`. The rAF loop and all stage internals are untouched.
- `<BackdropIsland>` does the same for `Backdrop`, with a `createEffect`
  forwarding the active pane to `setTheme()`.
- The 1 Hz poll keeps its main.ts role as settle authority; because `sync()`
  runs after each poll, the `activeRun → null` transition flips the regime
  switch reactively (replacing today's manual stage teardown in `render()`).
*Alternative considered*: converting the stage shell (kill counter, room pips,
supply line) to Solid while keeping playback imperative — deferred: it splits
ownership of one screen across two paradigms for marginal benefit.

### D4: UI-local state moves into component signals
Screen/pane routing, `detailId`, `equipSlot`/`equipCand`, the create-screen
draft, notices, and `kbdMenu` become signals/small stores scoped where they're
used (hub-level context for pane + dialogue + kbd; component-local for drafts).
The dialogue typewriter becomes a small `createDialogue()` primitive: a signal
for the full line, a signal for revealed chars advanced by a timer, a memo for
the visible slice — `paintDialogue()`/`completeDialogue()` DOM surgery is
deleted. Pure helpers (`dialogue.ts` line tables, `icons.ts`, `enemy-art.ts`,
`sectionIdFromName`, etc.) are imported unchanged.

### D5: Event handling goes native JSX; keyboard nav stays a document listener
The `data-action` delegation table in `bind()` is replaced by per-element JSX
handlers (Solid delegates them internally). The global `keydown` listener
survives as one `onMount`/`onCleanup`-managed document listener in the hub,
driving the `kbdMenu` signal; focus highlighting becomes a derived class on the
menu rows instead of a post-render `paintKbd()` pass.

### D6: Tests mount via `solid-js/web` `render()`
`ui-smoke.test.ts` and `stage.test.ts` swap `new UI(root, game)` for a
`mountApp(root, game)` helper (the same one `main.ts` uses) and keep their
DOM-querying assertions. Vitest jsdom config gets the Solid browser condition
(`resolve.conditions`/`server.deps.inline` per vite-plugin-solid guidance) so
the dev (non-SSR) build of Solid is used under jsdom.

## Risks / Trade-offs

- [Behavioral drift in keyboard navigation — the subtlest machinery being
  rewritten] → port `paintKbd`'s semantics deliberately; extend the jsdom smoke
  test with keydown-driven scenarios before converting.
- [Regime-switch races: stage teardown previously ordered imperatively in
  `render()`] → the store is the single source for `activeRun`; island
  `onCleanup` handles stop/teardown; test reload-mid-run and settle paths.
- [Snapshot cloning could theoretically miss non-JSON state] → engine state is
  already JSON-persisted (save file), so a structural clone is lossless by
  construction.
- [First runtime dependency; bundle grows ~7 kB gz] → accepted; Solid is small
  and tree-shakes well.
- [Solid under jsdom is config-sensitive] → pin the documented vitest setup;
  keep one trivial mount test as a canary.
- [Big-bang rewrite of a 1,145-line file] → screens are already independent
  template functions; convert as parallel `.tsx` files and delete `views.ts`
  only at the end, keeping the old path runnable until switchover.

## Migration Plan

1. Land deps + config (build still green with old UI).
2. Add store bridge + `<App>` shell mounting the old screens' replacements one
   at a time behind the router (select → create → hub → run island).
3. Swap `main.ts` entry, port tests, delete `views.ts` and dead helpers.
4. Rollback = revert the entry-point commit; engine and saves are untouched at
   every step.

## Open Questions

- None blocking. (If the stage shell later wants reactivity — e.g. richer
  supply/kill readouts — revisit D3's deferred split.)
