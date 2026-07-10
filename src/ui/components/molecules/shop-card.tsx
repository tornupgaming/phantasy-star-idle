/**
 * Nova-style shop list card shell (shop-list-card spec): the Phantasy Star
 * Nova card treatment for shop stock lists — hanging slot tab, recessed icon
 * well, rarity-colored name row, chip stat row, and a price + equip-
 * requirement right rail. Purely presentational; the item-aware derivation
 * lives in the `ShopListItem` organism. Selection stays the pane's `detailId`
 * contract: the card is a `<button role="option">` with `aria-selected`.
 */

import { createSignal, Show, type JSX } from "solid-js";

import type { IconId } from "../../icons";
import { Icon } from "../atoms/icon";
import { MesetaAmount } from "./meseta-amount";
import styles from "./shop-card.module.css";

/** Card stack container: spacing plus left padding for the slot-tab overhang. */
export function ShopList(props: { children: JSX.Element }) {
  return (
    <div
      class={`${styles.list} shop-list max-h-[62vh] overflow-auto flex flex-col gap-[9px] p-1 pl-4`}
      role="listbox"
    >
      {props.children}
    </div>
  );
}

export function ShopCard(props: {
  index: number;
  selected: boolean;
  onSelect: () => void;
  dataId: string;
  icon: IconId;
  /** Optional bundled raster art; falls back to `icon` when absent or failed. */
  imageUrl?: string;
  /** Global rarity class (`rarity-common` …) so theme name coloring applies. */
  rarityClass?: string;
  name: JSX.Element;
  sub: JSX.Element;
  price: number;
  req?: { text: string; met: boolean } | null;
}) {
  const [imageFailed, setImageFailed] = createSignal(false);
  return (
    <button
      class={props.rarityClass ? `${styles.card} ${props.rarityClass}` : styles.card}
      role="option"
      aria-selected={props.selected}
      data-action="detail"
      data-id={props.dataId}
      onClick={props.onSelect}
    >
      <span class={styles.slotTab}>{props.index + 1}</span>
      <span class={styles.iconWell}>
        <Show when={props.imageUrl && !imageFailed()} fallback={<Icon id={props.icon} />}>
          <img
            class={styles.iconImage}
            src={props.imageUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        </Show>
      </span>
      <span class={styles.body}>
        <span class={styles.nameRow}>{props.name}</span>
        <span class={styles.subRow}>{props.sub}</span>
      </span>
      <span class={styles.rail}>
        <MesetaAmount value={props.price} />
        <Show when={props.req}>
          {(req) => <span class={req().met ? styles.reqOk : styles.reqNo}>{req().text}</span>}
        </Show>
      </span>
    </button>
  );
}

/** One labelled stat chip in a card's sub row (chip class comes from the css module). */
export function StatChip(props: { chip: string; label: string; value: string | number; dim?: boolean }) {
  return (
    <span class={props.dim ? `${styles.stat} ${styles.dim}` : styles.stat}>
      <span class={`${styles.chip} ${props.chip}`}>{props.label}</span> {props.value}
    </span>
  );
}
