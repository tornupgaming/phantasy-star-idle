/**
 * Small shared presentational components for the menu screens: SVG icon
 * sprite plumbing (item-iconography), the tabbed HUD window frame
 * (pso-visual-theme), the select/create topbar, and the PSO-style stat
 * preview table used by shops and the equipment pane.
 */

import { For, Show, type JSX } from "solid-js";
import {
  effectiveStats,
  equipmentAtp,
  previewEquipment,
  type Character,
} from "../engine/character";
import type { Item } from "../engine/items";
import { iconForKind, spriteDefs, type IconId } from "./icons";
import { useUi } from "./context";
import type { Screen } from "./ui-shared";

export function Icon(props: { id: IconId }) {
  return (
    <svg class="icon" aria-hidden="true">
      <use href={`#i-${props.id}`} />
    </svg>
  );
}

export function KindIcon(props: { kind: string }) {
  return <Icon id={iconForKind(props.kind)} />;
}

/** Hidden <symbol> sprite sheet; rows reference glyphs with <use>. */
export function SpriteDefs() {
  return <span style="display:none" innerHTML={spriteDefs()} />;
}

/**
 * A named HUD window: orange tab header (title + optional trailing meta)
 * overlapping a pso-window body (pso-visual-theme "tab header" requirement).
 */
export function WindowBox(props: { title: string; trailing?: string; children: JSX.Element }) {
  return (
    <section class="pso-window win">
      <div class="pso-tab">
        <span class="tab-title">{props.title}</span>
        <Show when={props.trailing}>
          <span class="tab-meta">{props.trailing}</span>
        </Show>
      </div>
      <div class="win-body">{props.children}</div>
    </section>
  );
}

/** Select/create screens' top bar with the shared economy readout. */
export function Topbar(props: { title: string; back?: { label: string; screen: Screen } }) {
  const ui = useUi();
  return (
    <div class="topbar">
      <h1>
        <Show when={props.back}>
          {(back) => (
            <button class="small" data-action="goto" data-screen={back().screen} onClick={() => ui.goto(back().screen)}>
              ◀ {back().label}
            </button>
          )}
        </Show>{" "}
        ✦ {props.title}
      </h1>
      <div class="resources">
        <span class="meseta">{ui.state.economy.meseta} meseta</span>
        <span>{ui.state.economy.grinders} grinders</span>
      </div>
    </div>
  );
}

/**
 * PSO-style stat preview: current effective stats vs. as-if the change were
 * made, with ▲/▼ change markers. Displayed ATP folds in the equipment's
 * EQATP contribution (as PSO's status window does) so weapon comparisons are
 * meaningful — effectiveStats alone carries weapon ATP via the damage
 * formula, not the stat block.
 */
export function StatPreview(props: {
  slot: "weapon" | "frame" | "barrier" | "unit";
  item: Item | null;
  removeUnitId?: string;
}) {
  const ui = useUi();
  const rows = (): Array<[string, number, number]> => {
    const character = ui.selectedChar();
    const cur = effectiveStats(character);
    const nextEq = previewEquipment(character, props.slot, props.item as never, props.removeUnitId);
    const next = effectiveStats({ ...character, equipment: nextEq } as Character);
    return [
      ["ATP", cur.atp + Math.floor(equipmentAtp(character.equipment)), next.atp + Math.floor(equipmentAtp(nextEq))],
      ["DFP", cur.dfp, next.dfp],
      ["ATA", cur.ata, next.ata],
      ["EVP", cur.evp, next.evp],
      ["LCK", cur.lck, next.lck],
      ["HP", cur.hp, next.hp],
    ];
  };
  return (
    <table class="diff-table">
      <tbody>
        <tr>
          <th></th>
          <th class="muted">now</th>
          <th class="muted">after</th>
        </tr>
        <For each={rows()}>
          {([label, a, b]) => (
            <tr>
              <th>{label}</th>
              <td>{a}</td>
              <td class={b > a ? "diff-up" : b < a ? "diff-down" : "diff-same"}>
                {b} {b > a ? "▲" : b < a ? "▼" : ""}
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
