/** Character create screen (BB order: class → name → derived section ID). */

import { For, Show } from "solid-js";
import { CLASS_BY_ID, SECTION_IDS, type SectionId } from "../engine/classes";
import { sectionIdFromName } from "../engine/progression";
import { useUi } from "./context";
import { SpriteDefs, Topbar } from "./components";
import { CLASSES_CANONICAL } from "./ui-shared";

export function CreateScreen() {
  const ui = useUi();
  const def = () => CLASS_BY_ID[ui.draft.classId()];
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
    <>
      <SpriteDefs />
      <Topbar title="Create Character" back={{ label: "Back", screen: "select" }} />
      <div class="notice">{ui.notice()}</div>
      <div class="create-grid">
        <div class="panel">
          <h2>Class</h2>
          <div class="pso-menu">
            <For each={CLASSES_CANONICAL}>
              {(c) => (
                <button
                  class="pso-menu-row"
                  classList={{ selected: c.id === ui.draft.classId() }}
                  data-action="pick-class"
                  data-id={c.id}
                  onClick={() => ui.draft.setClassId(c.id)}
                >
                  <span style="flex:1">{c.name}</span>
                  <span class="meta">{c.role}</span>
                </button>
              )}
            </For>
          </div>
        </div>
        <div class="panel">
          <h2>
            {def().name} <span class="muted">{def().role}</span>
          </h2>
          <div class="stat-row" style="margin-bottom:12px">
            <span>
              ATP <b>{def().base.atp}</b>
            </span>
            <span>
              DFP <b>{def().base.dfp}</b>
            </span>
            <span>
              ATA <b>{def().base.ata}</b>
            </span>
            <span>
              EVP <b>{def().base.evp}</b>
            </span>
            <span>
              HP <b>{def().base.hp}</b>
            </span>
          </div>
          <h3>Name</h3>
          <div class="row">
            <input
              id="new-name"
              placeholder="Name"
              value={ui.draft.name()}
              style="flex:1"
              onInput={(e) => ui.draft.setName(e.currentTarget.value)}
            />
          </div>
          <div class="muted" style="margin:6px 0">
            Section ID: <b id="create-sid">{shownSid()}</b>
            <Show when={ui.draft.sid() === ""}>
              {" "}
              <span class="muted">(derived from name)</span>
            </Show>
          </div>
          <details class="advanced">
            <summary>Change section ID</summary>
            <div class="row">
              <label style="flex:1">
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
          <div class="row" style="margin-top:14px">
            <button class="primary" data-action="create-char" onClick={create}>
              Create
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
