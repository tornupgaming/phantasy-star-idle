import type { Item } from "../../../engine/items";
import { itemFlavor } from "../../dialogue";
import { itemMeta } from "../../ui-shared";
import { KindIcon } from "../atoms/icon";
import { ItemName } from "../atoms/item-name";

/** Detail-window header: icon + name, flavor line, stat meta line. */
export function ItemDetailHead(props: { item: Item }) {
  return (
    <>
      <div class="detail-name">
        <KindIcon kind={props.item.kind} /> <ItemName item={props.item} />
      </div>
      <div class="detail-flavor">{itemFlavor(props.item)}</div>
      <div class="muted small" style="margin-bottom:8px">
        {itemMeta(props.item)}
      </div>
    </>
  );
}

/** "E <name> — meta" line for the item currently occupying a slot. */
export function EquippedLine(props: { current: Item }) {
  return (
    <div class="equipped-line">
      <span class="equipped-mark">E</span> <ItemName item={props.current} /> —{" "}
      <span class="muted small">{itemMeta(props.current)}</span>
    </div>
  );
}
