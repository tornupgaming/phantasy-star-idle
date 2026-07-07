# Phantasy Star Idle — Claude guidance

A PSO-style idle ARPG. See `README.md` for stack, commands, and architecture.

## Rules

- The simulation engine (`src/engine/*`) is pure and runtime-agnostic; all
  randomness goes through the seeded RNG in `engine/rng.ts` (a test enforces
  no ad-hoc `Math.random`). Replays must stay deterministic: the same
  `(runId, seed)` must reproduce the identical battle log and loot.
- The UI (`src/ui/*`) is a SolidJS presentation layer (plus two imperative
  canvas/rAF islands); no game logic lives there. Persistence goes through
  the `StoragePort` in `engine/save.ts`. See "UI component architecture"
  below before adding or moving components.
- Saves are versioned (`SAVE_VERSION` in `engine/save.ts`). Any change to
  persisted state shape needs a version bump and a migration decision.
- Combat math follows authentic PSO formulas (hit/crit/spread, integer
  truncation, the hard 0-damage wall). Don't "fix" odd-looking math without
  checking it against the reference below.

## UI component architecture (atomic design)

All SolidJS components live under `src/ui/components/`, organized by atomic
design level. One component family per file, kebab-case filenames, named
exports. Place new components at the lowest level that fits; if a component
needs `useUi()`, it cannot be an atom or molecule.

- `atoms/` — single-purpose presentational bits (`Icon`, `MesetaIcon`,
  `ItemName`, `SpriteDefs`). Props-only: no `useUi()`, no engine mutations.
- `molecules/` — small compositions of atoms, still props-only
  (`MesetaAmount`, `WindowBox`, `Panel`, `PlayerHud`, `ItemRow`,
  `ShopList`/`ShopCard`/`StatChip`, `ItemDetailHead`/`EquippedLine`).
  Styling is Tailwind v4 utilities inline in the JSX; complex gradients,
  clip-paths, and multi-shadow treatments live in colocated CSS modules
  (`panel.module.css`, `shop-card.module.css`, shared PSO chrome in
  `components/chrome.module.css`). See "Styling" below.
- `organisms/` — self-contained UI sections that may read UI context via
  `useUi()` and dispatch engine actions through `ui.act(...)`: the hub panes
  (`guild-pane`, `gear-shop-pane`, `tool-shop-pane`, `bank-pane`,
  `equipment-pane`), `topbar`, `side-panel`, `hub-nav`, `report-banner`,
  `dialogue-window`, `stat-preview`, `shop-list-item`, `character-roster`,
  `character-create-form`, and `backdrop-island` (an organism-level wrapper
  around the imperative canvas Backdrop).
- `templates/` — pure arrangement, no behavior: `menu-screen-layout`
  (sprite defs + topbar + notice around select/create) and `hub-layout`
  (the corner-anchored HUD grid with status/nav/pane/dialogue slots).
- `pages/` — one per screen, filling a template with organisms and owning
  screen-level behavior: `select-page`, `create-page`, `hub-page` (keyboard
  navigation lives here), `run-page` (mounts the imperative `BattleStage`).

Above pages, `src/ui/app.tsx` is the shell: regime switch (active run →
`RunPage`, else the screen router) and `mountApp`. Non-component modules stay
at `src/ui/`: `context.tsx` (the `Ui` interface — all signals/actions),
`store.ts` (engine→Solid store sync), `ui-shared.ts` (constants +
formatters), `hooks.ts` (shared `useUi`-reading helpers), `icons.ts`, and
the out-of-scope imperative layer (`stage.ts`, `backdrop.ts`, `scene.ts`,
`typewriter.ts`, `dialogue.ts`, `enemy-art.ts`).

The vanilla-DOM islands (`BattleStage`, `Backdrop`) are deliberately not
reactive: Solid mounts a static shell and the island repaints via class-name
hooks (`stage-*`). Don't convert them to reactive rendering, and don't render
reactively into their DOM.

## Styling (Tailwind v4)

`src/ui/styles.css` is the Tailwind entry: design tokens in `@theme` (usable
as utilities — `text-muted`, `border-pso-edge`, `bg-psn-blue-900` — and as
`--color-*` vars in modules), element baseline skins (body, h1–h3, button,
input/select) in `@layer base`, and the composite `--psn-surface-*` /
`--pso-surface-window` gradient vars. Rules:

- Layout/spacing/typography/simple colors → utilities inline in JSX; complex
  gradients/clip-paths/multi-shadow chrome → CSS modules (shared chrome in
  `components/chrome.module.css`: `surface`, `tab`, `menu`/`menuRow`,
  `chip*`, `btnPrimary`).
- CSS-module rules are unlayered and beat utilities on the same property —
  keep modules to properties never overridden by utilities (e.g.
  `chrome.surface` carries no border-radius; callers add `rounded-[…]`).
- Classes driven by the imperative islands stay global plain CSS: `battle.css`
  (`stage-*`, `float-*`, bar family `hpbar`/`progress`/`xp-bar`, `log`/`l-*`,
  `room-cell`, `loot-chip`, `muted`, `outcome-*`), `scene.css` (`scene-*`),
  and `templates/hub-layout.css` (the `.hud` named-area grid + collapse
  breakpoints). Never Tailwind-ify those class names — stage.ts/backdrop.ts
  build them in strings, and tests query them.
- Behavioral hook classes (`pso-menu`, `pso-menu-row`, `selected`,
  `kbd-active`, `player-hud`, `stage-char-hp*`, `win`, `hud-*`, `meseta-*`,
  `dialog-scrim`, `dlg-text`, `rarity-*`, `name`, `meta`, `nav-num`,
  `chip-meta`) must stay as literal classes even when they carry no styles —
  keyboard nav, stage.ts, CSS-module `:global()` rules, and the UI smoke
  tests select on them.
- Class detection is restricted to `src/` via `source("../")` on the
  Tailwind import.

## Authentic PSO data reference

A clone of **newserv** (open-source PSO private server) lives at
`/home/psmith/projects/newserv/`. It is the canonical source for stats, drop
rates, item data, and the original calculations — port numbers from there
instead of inventing them. See `docs/newserv-reference.md` for a map of which
file holds what (drop tables, class stats, enemy stats, item parameters) and
which `.hh`/`.cc` files implement the logic.

## Subagents (context efficiency)

Delegate these instead of doing them inline — each floods the main context
with intermediate output when only the conclusion matters. Definitions in
`.claude/agents/`:

- `newserv-ref` — any "what does PSO/newserv do?" lookup; returns values +
  `file:line` citations, not source dumps.
- `balance-sim` — seeded simulation sweeps (clear rates, income, drop
  distributions, knob tuning); returns aggregate tables + a recommendation.
- `playcheck` — headless-Chromium play-checks per the `verify` skill; returns
  findings + screenshot paths (Read only the key screenshots afterward).
- `coder` — general implementation agent (Sonnet) for well-scoped coding
  tasks; give it a goal + acceptance criteria, it edits and runs tests.
- `pi-second-opinion` — cross-model review via the local Pi CLI (GPT-5.5);
  use for independent design/diff review or to break ties between approaches.

Also use the built-in Explore agent for broad code/spec searches, and prefer
one full-suite `vitest run` triage pass in a subagent when many tests fail at
once. Keep the main context for decisions, diffs, and edits.
