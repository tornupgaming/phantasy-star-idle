import { For } from "solid-js";
import { useUi } from "../../context";
import { PANES, PANE_LABELS } from "../../ui-shared";
import { WindowBox } from "../molecules/window-box";

/** Pioneer 2 nav window: numbered pane entries plus Change Character. */
export function HubNav() {
  const ui = useUi();
  return (
    <WindowBox title="Pioneer 2">
      <div class="pso-menu">
        <For each={PANES}>
          {(p, i) => (
            <button
              class="pso-menu-row"
              classList={{ selected: p === ui.pane() }}
              data-action="pane"
              data-pane={p}
              onClick={() => ui.setPane(p)}
            >
              <span class="nav-num">{i() + 1}</span>
              <span style="flex:1">{PANE_LABELS[p]}</span>
            </button>
          )}
        </For>
        <button class="pso-menu-row" data-action="goto" data-screen="select" onClick={() => ui.goto("select")}>
          <span class="nav-num">7</span>
          <span style="flex:1">Change Character</span>
        </button>
      </div>
    </WindowBox>
  );
}
