/** Character create form (BB order: class → name → derived section ID). */

import { For, Show } from "solid-js";
import { CLASS_BY_ID, SECTION_IDS, type SectionId } from "../../../engine/classes";
import { sectionIdFromName, statsAtLevel } from "../../../engine/progression";
import { useUi } from "../../context";
import { CLASSES_CANONICAL } from "../../ui-shared";
import chrome from "../chrome.module.css";

const panel = `${chrome.surface} rounded-[4px_18px_4px_12px] p-3.5`;

export function CharacterCreateForm() {
  const ui = useUi();
  const def = () => CLASS_BY_ID[ui.draft.classId()];
  const baseStats = () => statsAtLevel(ui.draft.classId(), 1);
  const shownSid = () => ui.draft.sid() || sectionIdFromName(ui.draft.name());

  const create = () => {
    const ok = ui.act(() =>
      ui.game.createCharacter(
        ui.draft.name(),
        ui.draft.classId(),
        ui.draft.sid() === "" ? undefined : (ui.draft.sid() as SectionId),
      ),
    );
    if (!ok) return;
    const created = ui.game.state.roster[ui.game.state.roster.length - 1].character;
    ui.act(() => ui.game.selectCharacter(created.id));
    ui.draft.setName("");
    ui.draft.setSid("");
    ui.goto("hub");
  };

  return (
    <div class="grid grid-cols-[minmax(260px,1fr)_minmax(320px,1.6fr)] gap-3.5 items-start max-[900px]:grid-cols-1">
      <div class={panel}>
        <h2>Class</h2>
        <div class={`pso-menu ${chrome.menu}`}>
          <For each={CLASSES_CANONICAL}>
            {(c) => (
              <button
                class={`pso-menu-row ${chrome.menuRow}`}
                classList={{ selected: c.id === ui.draft.classId() }}
                data-action="pick-class"
                data-id={c.id}
                onClick={() => ui.draft.setClassId(c.id)}
              >
                <span class="flex-1">{c.name}</span>
                <span class="meta">{c.role}</span>
              </button>
            )}
          </For>
        </div>
      </div>
      <div class={panel}>
        <h2>
          {def().name} <span class="text-muted">{def().role}</span>
        </h2>
        <div class="flex flex-wrap gap-x-3.5 gap-y-1.5 text-muted [&_b]:text-ink mb-3">
          <span>
            ATP <b>{baseStats().atp}</b>
          </span>
          <span>
            DFP <b>{baseStats().dfp}</b>
          </span>
          <span>
            ATA <b>{baseStats().ata}</b>
          </span>
          <span>
            EVP <b>{baseStats().evp}</b>
          </span>
          <span>
            HP <b>{baseStats().hp}</b>
          </span>
        </div>
        <h3>Name</h3>
        <div class="flex gap-2 items-center my-1.5 flex-wrap">
          <input
            id="new-name"
            placeholder="Name"
            value={ui.draft.name()}
            class="flex-1"
            onInput={(e) => ui.draft.setName(e.currentTarget.value)}
          />
        </div>
        <div class="text-muted my-1.5">
          Section ID: <b id="create-sid">{shownSid()}</b>
          <Show when={ui.draft.sid() === ""}>
            {" "}
            <span class="text-muted">(derived from name)</span>
          </Show>
        </div>
        <details>
          <summary class="cursor-pointer text-muted text-xs my-1.5">Change section ID</summary>
          <div class="flex gap-2 items-center my-1.5 flex-wrap">
            <label class="flex-1">
              Section ID
              <select id="new-sid" onChange={(e) => ui.draft.setSid(e.currentTarget.value as SectionId | "")}>
                <option value="" selected={ui.draft.sid() === ""}>
                  auto (from name)
                </option>
                <For each={SECTION_IDS}>
                  {(sid) => (
                    <option value={sid} selected={sid === ui.draft.sid()}>
                      {sid}
                    </option>
                  )}
                </For>
              </select>
            </label>
          </div>
        </details>
        <div class="flex gap-2 items-center mt-3.5 mb-1.5 flex-wrap">
          <button class={`primary ${chrome.btnPrimary}`} data-action="create-char" onClick={create}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
