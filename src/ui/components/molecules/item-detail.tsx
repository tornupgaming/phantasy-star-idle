import type { Item } from "../../../engine/items";
import { itemFlavor } from "../../dialogue";
import { itemMeta } from "../../ui-shared";
import { KindIcon } from "../atoms/icon";
import { ItemName } from "../atoms/item-name";

/** Detail-window header: icon + name, flavor line, stat meta line. */
export function ItemDetailHead(props: { item: Item }) {
  return (
    <>
      <div class="text-base font-bold text-accent mb-0.5">
        <KindIcon kind={props.item.kind} class="w-4 h-4 align-[-3px]" /> <ItemName item={props.item} />
      </div>
      <div class="italic text-[#bcd8e0] text-[12.5px] mt-0.5 mb-1.5">{itemFlavor(props.item)}</div>
      <div class="text-muted text-[11.5px] mb-2">{itemMeta(props.item)}</div>
    </>
  );
}

/** "E <name> — meta" line for the item currently occupying a slot. */
export function EquippedLine(props: { current: Item }) {
  return (
    <div class="text-pso-hp text-[12.5px] mb-1.5">
      <span class="inline-block bg-pso-hp text-[#04220a] text-[10px] font-bold leading-[1.4] px-1 rounded-[2px]">
        E
      </span>{" "}
      <ItemName item={props.current} /> — <span class="text-muted text-[11.5px]">{itemMeta(props.current)}</span>
    </div>
  );
}
