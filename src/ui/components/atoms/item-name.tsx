import type { Item } from "../../../engine/items";
import { itemDisplayName, itemNameClass } from "../../ui-shared";

/** An item's display name (grind suffix, attribute-bonus coloring). */
export function ItemName(props: { item: Item }) {
  return <span class={itemNameClass(props.item)}>{itemDisplayName(props.item)}</span>;
}
