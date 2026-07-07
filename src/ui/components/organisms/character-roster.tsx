/** Character roster grid (character-roster): slot cards + the empty create slot. */

import { For, Show } from "solid-js";
import { CLASS_BY_ID } from "../../../engine/classes";
import { useUi } from "../../context";
import { xpLine } from "../../ui-shared";
import chrome from "../chrome.module.css";

const slotCard =
  `${chrome.surface} rounded-[4px_18px_4px_12px] relative p-4 min-h-[130px] flex flex-col gap-1 cursor-pointer ` +
  "transition-shadow duration-150 hover:shadow-[0_0_16px_var(--color-pso-glow),0_0_0_1px_var(--color-pso-edge),inset_0_0_22px_rgba(20,90,110,0.35)]";

export function CharacterRoster() {
  const ui = useUi();
  return (
    <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
      <For each={ui.state.roster}>
        {(entry) => {
          const c = () => entry.character;
          return (
            <div
              class={slotCard}
              data-action="select-char"
              data-id={c().id}
              onClick={() => {
                if (ui.act(() => ui.game.selectCharacter(c().id))) ui.goto("hub");
              }}
            >
              <div class="text-[17px] font-bold text-accent">{c().name}</div>
              <div class="text-muted text-xs">
                Lv {c().level} {CLASS_BY_ID[c().classId].name}
              </div>
              <div class="text-muted text-xs">
                {c().sectionId} · {xpLine(c().classId, c().level, c().xp)}
              </div>
              <div class="mt-auto flex justify-end">
                <Show when={ui.state.roster.length > 1}>
                  <button
                    class="px-2 py-[3px] text-xs"
                    data-action="delete-char"
                    data-id={c().id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete ${c().name}? Equipped gear returns to the shared inventory.`)) {
                        ui.act(() => ui.game.deleteCharacter(c().id));
                      }
                    }}
                  >
                    Delete
                  </button>
                </Show>
              </div>
            </div>
          );
        }}
      </For>
      <div
        class={`${slotCard} ${chrome.surfaceDashed} items-center justify-center text-muted italic`}
        data-action="goto"
        data-screen="create"
        onClick={() => ui.goto("create")}
      >
        — Empty Slot —
      </div>
    </div>
  );
}
