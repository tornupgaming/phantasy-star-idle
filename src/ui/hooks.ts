/** Shared context-reading helpers for organisms (not presentational markup). */

import type { Item } from "../engine/items";
import { useUi } from "./context";

/** The equipped item currently occupying the slot an item would go into. */
export function useEquippedInSlot() {
  const ui = useUi();
  return (item: Item): Item | null => {
    const eq = ui.selectedChar().equipment;
    return item.kind === "weapon" ? eq.weapon : item.kind === "frame" ? eq.frame : item.kind === "barrier" ? eq.barrier : null;
  };
}
