import type { Item } from "../../../engine/items";
import { itemDisplayName, weaponHasAttributeBonuses } from "../../ui-shared";

const RARITY_TEXT_CLASS: Record<Item["rarity"], string> = {
  common: "",
  uncommon: "text-accent",
  rare: "text-gold",
};

/**
 * An item's display name (grind suffix, attribute-bonus coloring). Weapon
 * attribute bonuses take priority over rarity coloring, matching the old
 * `.weapon-attributes` override. Keeps the literal `name` class as a bare
 * hook — shop-card.module.css glows it via `:global(.rarity-rare) :global(.name)`.
 */
export function ItemName(props: { item: Item }) {
  const cls = () =>
    weaponHasAttributeBonuses(props.item)
      ? "name text-good"
      : `name ${RARITY_TEXT_CLASS[props.item.rarity]}`.trim();
  return <span class={cls()}>{itemDisplayName(props.item)}</span>;
}
