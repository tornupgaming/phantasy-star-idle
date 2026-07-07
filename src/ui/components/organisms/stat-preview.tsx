import { For } from "solid-js";
import {
  effectiveStats,
  equipmentAtp,
  previewEquipment,
  type Character,
} from "../../../engine/character";
import type { Item } from "../../../engine/items";
import { useUi } from "../../context";
import { weaponAvd } from "../../ui-shared";

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
    const out: Array<[string, number, number]> = [
      ["ATP", cur.atp + Math.floor(equipmentAtp(character.equipment)), next.atp + Math.floor(equipmentAtp(nextEq))],
      ["DFP", cur.dfp, next.dfp],
      ["ATA", cur.ata, next.ata],
      ["EVP", cur.evp, next.evp],
      ["LCK", cur.lck, next.lck],
      ["HP", cur.hp, next.hp],
    ];
    if (props.slot === "weapon") {
      out.push(["AVD%", weaponAvd(character.equipment.weapon), weaponAvd(nextEq.weapon)]);
    }
    return out;
  };
  return (
    <table class="diff-table border-collapse min-w-[180px] [&_th]:text-right [&_th]:py-[3px] [&_th]:pr-2.5 [&_th]:font-semibold [&_th]:text-muted [&_td]:text-right [&_td]:py-[3px] [&_td]:pr-2.5 [&_td]:font-normal [&_td]:tabular-nums">
      <tbody>
        <tr>
          <th></th>
          <th>now</th>
          <th>after</th>
        </tr>
        <For each={rows()}>
          {([label, a, b]) => (
            <tr>
              <th>{label}</th>
              <td>{a}</td>
              <td class={b > a ? "text-good font-bold" : b < a ? "text-bad font-bold" : ""}>
                {b} {b > a ? "▲" : b < a ? "▼" : ""}
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
