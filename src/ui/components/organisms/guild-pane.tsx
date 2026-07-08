/**
 * Hunter's Guild quest counter (pso-hud-menus): episode/difficulty/pattern
 * selection + Accept Quest and the loot-filter Counter Settings window in the
 * central panel; the zone-grouped destination list in the detail panel. Menu
 * idioms only — no form controls in the menu column.
 */

import { For } from "solid-js";
import { AREA_LIST } from "../../../engine/content";
import { DIFFICULTIES, type DifficultyId, type ZoneId } from "../../../engine/areas";
import { useUi } from "../../context";
import { PATTERN_PRESETS, patternMeta, patternName, supplyLine } from "../../ui-shared";
import { MesetaIcon } from "../atoms/meseta-icon";
import { WindowBox } from "../molecules/window-box";
import chrome from "../chrome.module.css";

const ZONES: ZoneId[] = ["Forest", "Caves", "Mines", "Ruins"];

/** Episode picker: Ep1 is live; Ep2/Ep4 await their data extraction. */
const EPISODES = [
  { id: "1", label: "Episode 1", enabled: true },
  { id: "2", label: "Episode 2", enabled: false },
  { id: "4", label: "Episode 4", enabled: false },
];

export function GuildPane() {
  const ui = useUi();
  let filterBelow!: HTMLInputElement;
  let filterKeepRare!: HTMLInputElement;

  return (
    <>
      <section class="hud-pane">
        <WindowBox title="Hunter's Guild" trailing="Quest Counter">
          <h3>Episode</h3>
          <div class="flex flex-wrap gap-2">
            <For each={EPISODES}>
              {(ep) => (
                <button
                  class={`${chrome.chip} ${chrome.chipHex}`}
                  classList={{ [chrome.chipSelected]: ep.enabled }}
                  data-action="episode"
                  data-id={ep.id}
                  disabled={!ep.enabled}
                >
                  {ep.label}
                </button>
              )}
            </For>
          </div>
          <h3 class="mt-2.5">Difficulty</h3>
          <div class="flex flex-wrap gap-2">
            <For each={Object.keys(DIFFICULTIES) as DifficultyId[]}>
              {(d) => (
                <button
                  class={`${chrome.chip} ${chrome.chipHex}`}
                  classList={{ [chrome.chipSelected]: d === ui.diffSel() }}
                  data-action="diff"
                  data-id={d}
                  onClick={() => ui.setDiffSel(d)}
                >
                  {DIFFICULTIES[d].label}
                </button>
              )}
            </For>
          </div>
          <h3 class="mt-2.5">Attack pattern</h3>
          <div class="flex flex-wrap gap-2">
            <For each={Object.keys(PATTERN_PRESETS)}>
              {(name) => (
                <button
                  class={chrome.chip}
                  classList={{ [chrome.chipSelected]: name === patternName(ui.selectedEntry().pattern) }}
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
            class={`primary ${chrome.btnPrimary} w-full mt-3.5`}
            data-action="send"
            onClick={() => ui.act(() => ui.game.sendRun(ui.areaSel(), ui.diffSel()))}
          >
            ▶ Accept Quest
          </button>
        </WindowBox>
        <WindowBox title="Counter Settings">
          <h3>Loot filter</h3>
          <div class="flex gap-2 items-center my-1.5 flex-wrap">
            <label>
              Auto-sell below{" "}
              <input
                id="filter-below"
                ref={filterBelow}
                type="number"
                min="0"
                value={ui.selectedEntry().filter.autoSellBelow}
                class="w-[90px]"
              />{" "}
              <MesetaIcon />
            </label>
          </div>
          <div class="flex gap-2 items-center my-1.5 flex-wrap">
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
              class="px-2 py-[3px] text-xs"
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
          <h3 class="mt-3">Supply</h3>
          <div class="text-muted">{supplyLine(ui.state.supply)}</div>
        </WindowBox>
      </section>
      <aside class="hud-detail">
        <WindowBox title="Destination" trailing="Ragol">
          <div class={`pso-menu ${chrome.menu}`}>
            <For each={ZONES}>
              {(zone) => (
                <>
                  <h3 class="mt-1.5 first:mt-0">{zone}</h3>
                  <For each={AREA_LIST.filter((a) => a.zone === zone)}>
                    {(a) => (
                      <button
                        class={`pso-menu-row ${chrome.menuRow}`}
                        classList={{ selected: a.id === ui.areaSel() }}
                        data-action="area"
                        data-id={a.id}
                        onClick={() => ui.setAreaSel(a.id)}
                      >
                        <span class="flex-1">{a.name}</span>
                        <span class="meta">
                          {a.boss ? "BOSS · " : ""}rec. ATP {a.recommendedAtp}
                        </span>
                      </button>
                    )}
                  </For>
                </>
              )}
            </For>
          </div>
        </WindowBox>
      </aside>
    </>
  );
}
