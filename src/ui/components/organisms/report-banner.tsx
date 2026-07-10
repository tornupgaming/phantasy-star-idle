import { For, Show } from "solid-js";
import { useUi } from "../../context";
import { itemDisplayName, itemNameClass, supplyLine } from "../../ui-shared";
import { MesetaAmount } from "../molecules/meseta-amount";

/** Post-run quest report, anchored to the Guild pane (ui-navigation D2). */
export function ReportBanner() {
  const ui = useUi();
  const r = () => ui.state.lastReport!;
  return (
    <div
      class="relative border bg-(image:--pso-surface-window) shadow-[0_0_14px_var(--color-pso-glow)] p-3.5 max-w-[640px] w-full"
      classList={{ "border-accent": r().outcome !== "ejected", "border-bad": r().outcome === "ejected" }}
    >
      <h2 class={r().outcome === "complete" ? "text-good" : "text-bad"}>
        {r().outcome === "complete" ? "Run complete!" : "Ejected!"} — {r().characterName}, {r().areaName} (
        {r().difficultyLabel})
      </h2>
      <div class="flex flex-wrap gap-x-3.5 gap-y-1.5 text-muted [&_b]:text-ink">
        <span>
          Rooms{" "}
          <b>
            {r().roomsCleared}/{r().totalRooms}
          </b>
        </span>
        <span>
          Meseta <b><MesetaAmount value={r().meseta} /></b>
        </span>
        <span>
          XP{" "}
          <b>
            {r().xpGained}
            {r().levelsGained > 0 ? ` (LEVEL UP → ${r().level}!)` : ""}
          </b>
        </span>
        <span>
          Grinders <b>{r().grinders}</b>
        </span>
      </div>
      <div class="mt-1.5">
        Kept:{" "}
        <b>
          <Show when={r().items.length > 0} fallback="no gear kept">
            <For each={r().items}>
              {(item, idx) => (
                <>
                  <span class={itemNameClass(item) ? "text-good" : undefined}>{itemDisplayName(item)}</span>
                  {idx() < r().items.length - 1 ? ", " : ""}
                </>
              )}
            </For>
          </Show>
        </b>
      </div>
      <div class="text-muted">
        Consumables gained: {supplyLine(r().consumablesGained)} · used: {supplyLine(r().consumablesUsed)}
      </div>
      <div class="flex gap-2 items-center mt-2.5 mb-1.5 flex-wrap">
        <button data-action="dismiss-report" onClick={() => ui.act(() => ui.game.dismissLastReport())}>
          Close
        </button>
      </div>
    </div>
  );
}
