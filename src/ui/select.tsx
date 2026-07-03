/** Character select screen (ui-navigation, character-roster). */

import { For, Show } from "solid-js";
import { CLASS_BY_ID } from "../engine/classes";
import { useUi } from "./context";
import { SpriteDefs, Topbar } from "./components";
import { xpLine } from "./ui-shared";

export function SelectScreen() {
  const ui = useUi();
  return (
    <>
      <SpriteDefs />
      <Topbar title="Phantasy Star Idle — Select Character" />
      <div class="notice">{ui.notice()}</div>
      <div class="slot-grid">
        <For each={ui.state.roster}>
          {(entry) => {
            const c = () => entry.character;
            return (
              <div
                class="panel slot-card"
                data-action="select-char"
                data-id={c().id}
                onClick={() => {
                  if (ui.act(() => ui.game.selectCharacter(c().id))) ui.goto("hub");
                }}
              >
                <div class="slot-name">{c().name}</div>
                <div class="slot-meta">
                  Lv {c().level} {CLASS_BY_ID[c().classId].name}
                </div>
                <div class="slot-meta">
                  {c().sectionId} · {xpLine(c().classId, c().level, c().xp)}
                </div>
                <div class="slot-actions">
                  <Show when={ui.state.roster.length > 1}>
                    <button
                      class="small"
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
        <div class="panel slot-card empty" data-action="goto" data-screen="create" onClick={() => ui.goto("create")}>
          — Empty Slot —
        </div>
      </div>
    </>
  );
}
