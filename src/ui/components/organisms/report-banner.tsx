import { For, Show } from "solid-js";
import { useUi } from "../../context";
import { itemDisplayName, itemNameClass, supplyLine } from "../../ui-shared";
import { MesetaAmount } from "../molecules/meseta-amount";

/** Post-run quest report, anchored to the Guild pane (ui-navigation D2). */
export function ReportBanner() {
  const ui = useUi();
  const r = () => ui.state.lastReport!;
  return (
    <div class={`report ${r().outcome}`}>
      <h2 class={`outcome-${r().outcome}`}>
        {r().outcome === "complete" ? "Run complete!" : "Ejected!"} — {r().characterName}, {r().areaName} (
        {r().difficultyLabel})
      </h2>
      <div class="stat-row">
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
      <div style="margin-top:6px">
        Kept:{" "}
        <b>
          <Show when={r().items.length > 0} fallback="no gear kept">
            <For each={r().items}>
              {(item, idx) => (
                <>
                  <span class={itemNameClass(item)}>{itemDisplayName(item)}</span>
                  {idx() < r().items.length - 1 ? ", " : ""}
                </>
              )}
            </For>
          </Show>
        </b>
      </div>
      <div class="muted">
        Consumables gained: {supplyLine(r().consumablesGained)} · used: {supplyLine(r().consumablesUsed)}
      </div>
      <div class="row" style="margin-top:10px">
        <button data-action="dismiss-report" onClick={() => ui.setReportDismissed(true)}>
          Close
        </button>
      </div>
    </div>
  );
}
