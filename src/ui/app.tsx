/**
 * App shell (convert-menu-ui-to-solidjs D3): the regime switch — an active
 * run mounts the imperative battle-stage island and overrides all other
 * screens (ui-navigation); otherwise the menu regime renders the screen
 * router over the persistent backdrop island. When a run settles, the router
 * is forced back to the hub's Guild pane with the quest report showing.
 */

import { Match, Show, Suspense, Switch, createEffect, lazy, on } from "solid-js";
import { render } from "solid-js/web";
import type { Game } from "../engine/game";
import { createGameStore, type GameStore } from "./store";
import { createUi, UiProvider, useUi } from "./context";
import { BackdropIsland } from "./components/organisms/backdrop-island";
import { SelectPage } from "./components/pages/select-page";
import { CreatePage } from "./components/pages/create-page";
import { HubPage } from "./components/pages/hub-page";

const RunPage = lazy(() =>
  import("./components/pages/run-page").then(({ RunPage }) => ({ default: RunPage })),
);

function MenuRegime() {
  const ui = useUi();
  return (
    <>
      <BackdropIsland />
      <div class={`ui-layer screen-${ui.screen()}`}>
        <Switch>
          <Match when={ui.screen() === "select"}>
            <SelectPage />
          </Match>
          <Match when={ui.screen() === "create"}>
            <CreatePage />
          </Match>
          <Match when={ui.screen() === "hub"}>
            <HubPage />
          </Match>
        </Switch>
      </div>
    </>
  );
}

export function App(props: { game: Game; gs: GameStore }) {
  const ui = createUi(props.game, props.gs);

  // Run-settled transition: back to the hub's Guild pane with the report
  // dialog fresh (replaces the old imperative stage-teardown branch).
  createEffect(
    on(
      () => ui.state.activeRun !== null,
      (active, prevActive) => {
        if (prevActive && !active) ui.onRunSettled();
      },
      { defer: true },
    ),
  );

  return (
    <UiProvider value={ui}>
      <Show when={ui.state.activeRun} fallback={<MenuRegime />}>
        <Suspense fallback={<div class="run-screen">Loading run…</div>}>
          <RunPage />
        </Suspense>
      </Show>
    </UiProvider>
  );
}

/**
 * Mount the UI into `root`. Returns the store's `sync` (the 1 Hz poll calls
 * it after `game.poll()` — the poll remains the settle authority) and a
 * `dispose` for tests.
 */
export function mountApp(root: HTMLElement, game: Game): { sync: () => void; dispose: () => void } {
  const gs = createGameStore(game);
  const dispose = render(() => <App game={game} gs={gs} />, root);
  return { sync: gs.sync, dispose };
}
