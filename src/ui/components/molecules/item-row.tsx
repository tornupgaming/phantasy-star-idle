import type { JSX } from "solid-js";
import type { Item } from "../../../engine/items";
import { Icon } from "../atoms/icon";
import { ItemName } from "../atoms/item-name";
import { iconForKind } from "../../icons";

/** Classic pso-menu row for an item list (inventory/bank). */
export function ItemRow(props: { item: Item; trailing: JSX.Element; selected: boolean; onSelect: () => void }) {
  return (
    <button
      class={`pso-menu-row rarity-${props.item.rarity}`}
      classList={{ selected: props.selected }}
      data-action="detail"
      data-id={props.item.id}
      onClick={props.onSelect}
    >
      <Icon id={iconForKind(props.item.kind)} />
      <span class="name" style="flex:1">
        <ItemName item={props.item} />
      </span>
      <span class="meta num">{props.trailing}</span>
    </button>
  );
}
