/**
 * Hunter's Guild quest counter (pso-hud-menus): area/difficulty/pattern
 * selection + Accept Quest, with the loot-filter Counter Settings detail
 * window. Menu idioms only — no form controls in the menu column.
 */

import { For } from "solid-js";
import { AREA_LIST } from "../../../engine/content";
import { DIFFICULTIES, type DifficultyId } from "../../../engine/areas";
import { useUi } from "../../context";
import { PATTERN_PRESETS, patternMeta, patternName, supplyLine } from "../../ui-shared";
import { MesetaIcon } from "../atoms/meseta-icon";
import { WindowBox } from "../molecules/window-box";

export function GuildPane() {
  const ui = useUi();
  let filterBelow!: HTMLInputElement;
  let filterKeepRare!: HTMLInputElement;

  return (
    <>
      <section class="hud-pane">
        <WindowBox title="Hunter's Guild" trailing="Quest Counter">
          <h3>Area</h3>
          <div class="pso-menu">
            <For each={AREA_LIST}>
              {(a) => (
                <button
                  class="pso-menu-row"
                  classList={{ selected: a.id === ui.areaSel() }}
                  data-action="area"
                  data-id={a.id}
                  onClick={() => ui.setAreaSel(a.id)}
                >
                  <span style="flex:1">{a.name}</span>
                  <span class="meta">rec. ATP {a.recommendedAtp}</span>
                </button>
              )}
            </For>
          </div>
          <h3 style="margin-top:10px">Difficulty</h3>
          <div class="chip-row">
            <For each={Object.keys(DIFFICULTIES) as DifficultyId[]}>
              {(d) => (
                <button
                  class="chip hex"
                  classList={{ selected: d === ui.diffSel() }}
                  data-action="diff"
                  data-id={d}
                  onClick={() => ui.setDiffSel(d)}
                >
                  {DIFFICULTIES[d].label}
                </button>
              )}
            </For>
          </div>
          <h3 style="margin-top:10px">Attack pattern</h3>
          <div class="chip-row">
            <For each={Object.keys(PATTERN_PRESETS)}>
              {(name) => (
                <button
                  class="chip"
                  classList={{ selected: name === patternName(ui.selectedEntry().pattern) }}
                  data-action="pattern"
                  data-id={name}
                  onClick={() => ui.act(() => ui.game.setPattern(PATTERN_PRESETS[name]))}
                >
                  {name} <span class="chip-meta">{patternMeta(PATTERN_PRESETS[name])}</span>
                </button>
              )}
            </For>
          </div>
          <button
            class="primary"
            data-action="send"
            style="width:100%;margin-top:14px"
            onClick={() => ui.act(() => ui.game.sendRun(ui.areaSel(), ui.diffSel()))}
          >
            ▶ Accept Quest
          </button>
        </WindowBox>
      </section>
      <aside class="hud-detail">
        <WindowBox title="Counter Settings">
          <h3>Loot filter</h3>
          <div class="row">
            <label>
              Auto-sell below{" "}
              <input
                id="filter-below"
                ref={filterBelow}
                type="number"
                min="0"
                value={ui.selectedEntry().filter.autoSellBelow}
                style="width:90px"
              />{" "}
              <MesetaIcon />
            </label>
          </div>
          <div class="row">
            <label>
              <input
                id="filter-keep-rare"
                ref={filterKeepRare}
                type="checkbox"
                checked={ui.selectedEntry().filter.alwaysKeep.includes("rare")}
              />{" "}
              keep rares
            </label>
            <button
              class="small"
              data-action="apply-filter"
              onClick={() =>
                ui.act(
                  () =>
                    ui.game.setFilter({
                      autoSellBelow: Number(filterBelow.value),
                      alwaysKeep: filterKeepRare.checked ? ["rare"] : [],
                    }),
                  "filter",
                )
              }
            >
              Apply
            </button>
          </div>
          <h3 style="margin-top:12px">Supply</h3>
          <div class="muted">{supplyLine(ui.state.supply)}</div>
        </WindowBox>
      </aside>
    </>
  );
}
