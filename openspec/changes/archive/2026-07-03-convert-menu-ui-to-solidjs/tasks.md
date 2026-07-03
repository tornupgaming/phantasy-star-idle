# Tasks — Convert menu-regime UI to SolidJS

## 1. Toolchain setup

- [x] 1.1 Add `solid-js` and `vite-plugin-solid` to package.json; install
- [x] 1.2 Configure `vite.config` with the Solid plugin and `tsconfig` with `"jsx": "preserve"`, `"jsxImportSource": "solid-js"`; verify `npm run build` still passes with the old UI in place
- [x] 1.3 Configure vitest for Solid under jsdom (browser resolve conditions / deps inlining per vite-plugin-solid docs); add a trivial canary test that mounts a Solid component in jsdom

## 2. Engine-state bridge (design D2)

- [x] 2.1 Implement `createGameStore(game)` in `src/ui/store.ts`: `createStore` seeded from a structural snapshot of `game.state`, plus `sync()` running `reconcile(snapshot)`
- [x] 2.2 Implement an actions wrapper: each UI-invoked `game.*` mutation goes through a helper that calls the engine API then `sync()`; the 1 Hz poll path also calls `sync()`
- [x] 2.3 Unit-test the bridge: engine has no solid-js imports (extend or mirror the ad-hoc-import guard style), action-then-sync visibility, reconcile keeps unchanged branch references stable

## 3. App shell, router, and islands (design D3)

- [x] 3.1 Create `<App>` with the regime switch (`activeRun` → run regime, else menu router) and the screen router (select / create / hub)
- [x] 3.2 Implement `<BackdropIsland>`: mounts `Backdrop` once in `onMount`, `destroy()` on cleanup, `createEffect` forwarding pane → `setTheme()`; hidden (not unmounted) when off-hub per current `scene-hidden` behavior
- [x] 3.3 Implement `<StageIsland>`: renders the run-shell markup, constructs `new BattleStage(el, game).start()` on mount, `stop()` on cleanup; verify settle flips back to hub/guild reactively
- [x] 3.4 Update `src/main.ts` to mount `<App>` via `solid-js/web` `render()` and keep the 1 Hz poll as settle authority calling `sync()`

## 4. Menu screens as components (design D4/D5)

- [x] 4.1 Port the character select screen (roster cards, delete-with-confirm, empty slot → create)
- [x] 4.2 Port the character create screen (class list, name input with derived section ID, override select, create action) with draft state in component signals
- [x] 4.3 Implement `createDialogue()` primitive (line signal, revealed-chars timer, visible-slice memo, skip-to-end) and the dialogue window component; port greeting/reaction cycle state
- [x] 4.4 Port the hub shell: topbar, pane nav, notices, backdrop theme wiring
- [x] 4.5 Port the Hunters Guild pane (area/difficulty/pattern selection, loot filter, Accept Quest, post-run report)
- [x] 4.6 Port the shop panes (weapon/armour/tool: list+detail, buy actions, grinder purchase) and bank/inventory + equipment panes (slot + candidate selection)
- [x] 4.7 Port keyboard navigation: single document `keydown` listener managed by hub `onMount`/`onCleanup`, `kbdMenu` signal, focus highlight as derived row class; remove `paintKbd`-style restoration

## 5. Tests, switchover, cleanup

- [x] 5.1 Port `tests/ui-smoke.test.ts` to mount via the shared `mountApp` helper; extend with keydown-driven hub navigation scenarios and a mid-reveal-dialogue re-render scenario (spec: transient state survives)
- [x] 5.2 Port `tests/stage.test.ts` (island mount/dispose across run start, reload-mid-run, settle)
- [x] 5.3 Delete `src/ui/views.ts` and any dead helpers; confirm `dialogue.ts`, `icons.ts`, `enemy-art.ts`, `stage.ts`, `scene.ts`, `backdrop.ts` are consumed unchanged
- [x] 5.4 Full gate: `npm run typecheck`, `npm test`, `npm run build`; manual pass through select → create → hub panes → send run → settle → report against existing UI specs
