import { Show } from "solid-js";
import { useUi } from "../../context";
import type { Screen } from "../../ui-shared";
import { MesetaAmount } from "../molecules/meseta-amount";

/** Select/create screens' top bar with the shared economy readout. */
export function Topbar(props: { title: string; back?: { label: string; screen: Screen } }) {
  const ui = useUi();
  return (
    <div class="flex justify-between items-center gap-3 mb-4">
      <h1>
        <Show when={props.back}>
          {(back) => (
            <button
              class="px-2 py-[3px] text-xs"
              data-action="goto"
              data-screen={back().screen}
              onClick={() => ui.goto(back().screen)}
            >
              ◀ {back().label}
            </button>
          )}
        </Show>{" "}
        ✦ {props.title}
      </h1>
      <div class="flex gap-4 font-semibold">
        <span class="text-gold"><MesetaAmount value={ui.state.economy.meseta} /></span>
        <span>{ui.state.economy.grinders} grinders</span>
      </div>
    </div>
  );
}
