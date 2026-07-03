# Convert menu-regime UI to SolidJS

## Why

The menu screens (select / create / hub) re-render by wholesale `innerHTML` replacement, which forces a pile of workarounds: ~10 `UI` class fields exist solely to "survive re-renders", `paintDialogue()` re-attaches a typewriter interval to a freshly destroyed DOM node, `paintKbd()` restores keyboard focus after every paint, and `bind()` re-wires all listeners each render. SolidJS's fine-grained reactivity removes that entire class of bug and workaround: state lives in signals/stores, the DOM updates in place, and transient UI state (dialogue reveal, keyboard focus, selection highlights) survives naturally.

## What Changes

- Rewrite the menu regime of `src/ui/views.ts` (select, create, hub screens: topbar, panes, dialogue window, keyboard navigation, notices) as SolidJS components (TSX).
- Bridge engine state to the UI via a Solid `createStore` synchronized with `reconcile(snapshot)` after every game action and 1 Hz poll. The engine (`src/engine/*`) remains pure, mutation-based, and Solid-ignorant — **no engine changes**.
- Keep `BattleStage` (rAF event playback, float glyphs, HP tweens) and `Backdrop` (canvas) as imperative islands mounted from Solid via refs; their internals are untouched.
- Add `solid-js` and `vite-plugin-solid` dependencies; enable Solid JSX in the TypeScript/Vite config.
- Port the jsdom UI tests (`ui-smoke.test.ts`, `stage.test.ts`) to mount via `solid-js/web` `render()`; assertions against rendered DOM largely carry over.
- No behavior changes intended: all existing UI specs (ui-navigation, shop-dialogue, pso-visual-theme, hub-scene-backdrop, battle-scene-view, item-iconography) must keep passing as written.

## Capabilities

### New Capabilities
- `reactive-ui-architecture`: The UI layer's rendering contract — fine-grained reactive updates for menu screens (no wholesale DOM replacement on interaction), transient UI state preserved across updates, imperative islands for the battle stage and backdrop, and a one-way engine-state → UI store bridge that keeps the simulation engine framework-agnostic.

### Modified Capabilities

<!-- none — this change re-platforms the implementation; all existing UI capability
     requirements (ui-navigation, shop-dialogue, hub-scene-backdrop, battle-scene-view,
     pso-visual-theme, item-iconography) are preserved unchanged. -->

## Impact

- **Code**: `src/ui/views.ts` (1,145 loc) rewritten as TSX components under `src/ui/`; `src/main.ts` entry updated to mount the Solid root; `src/ui/dialogue.ts`, `icons.ts`, `enemy-art.ts` (pure helpers) reused as-is; `src/ui/stage.ts`, `backdrop.ts`, `scene.ts` unchanged.
- **Dependencies**: adds `solid-js` (runtime) and `vite-plugin-solid` (build); first runtime dependency in the project.
- **Config**: `vite.config`, `tsconfig` (`jsx: "preserve"`, `jsxImportSource: "solid-js"`), vitest jsdom config for Solid.
- **Tests**: `tests/ui-smoke.test.ts` and `tests/stage.test.ts` mounting rewritten; engine tests untouched.
- **Risk**: behavior regressions in keyboard navigation and dialogue flow — mitigated by keeping existing specs as the acceptance bar.
