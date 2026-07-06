/**
 * Nova-style shop list card (shop-list-card spec): the Phantasy Star Nova
 * card treatment for shop stock lists — hanging slot tab, recessed icon well,
 * rarity-colored name row, per-kind chip stat row, and a price + equip-
 * requirement right rail. `ShopCard` is the presentational shell (also used
 * for consumable/grinder offers); `ShopListItem` derives the per-kind content
 * from an engine `Item`. Selection stays the pane's `detailId` contract:
 * the card is a `<button role="option">` with `aria-selected`.
 */

import { Show, type JSX } from "solid-js";

import { baseStats, type Character } from "../../engine/character";
import { weaponAvoidancePct } from "../../engine/data/avoidance";
import { armorStatCeiling } from "../../engine/data/item-table";
import { weaponKindOf, type Item, type Weapon } from "../../engine/items";
import { Icon, MesetaAmount } from "../components";
import { iconForKind, type IconId } from "../icons";
import { useUi } from "../context";
import styles from "./shop-list-item.module.css";

/** Card stack container: spacing plus left padding for the slot-tab overhang. */
export function ShopList(props: { children: JSX.Element }) {
  return (
    <div class={`${styles.list} shop-list`} role="listbox">
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
  /** Global rarity class (`rarity-common` …) so theme name coloring applies. */
  rarityClass?: string;
  name: JSX.Element;
  sub: JSX.Element;
  price: number;
  req?: { text: string; met: boolean } | null;
}) {
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
        <Icon id={props.icon} />
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

function StatChip(props: { chip: string; label: string; value: string | number; dim?: boolean }) {
  return (
    <span class={props.dim ? `${styles.stat} ${styles.dim}` : styles.stat}>
      <span class={`${styles.chip} ${props.chip}`}>{props.label}</span> {props.value}
    </span>
  );
}

function WeaponSub(props: { item: Weapon }) {
  const pct = (v: number | undefined) => v ?? 0;
  const b = () => props.item.bonuses;
  return (
    <>
      <StatChip chip={styles.chipN} label="N" value={pct(b()?.native)} dim={!pct(b()?.native)} />
      <StatChip chip={styles.chipAb} label="A" value={pct(b()?.aBeast)} dim={!pct(b()?.aBeast)} />
      <StatChip chip={styles.chipM} label="M" value={pct(b()?.machine)} dim={!pct(b()?.machine)} />
      <StatChip chip={styles.chipD} label="D" value={pct(b()?.dark)} dim={!pct(b()?.dark)} />
      <Show when={pct(b()?.hit) > 0}>
        <StatChip chip={styles.chipHit} label="HIT" value={pct(b()?.hit)} />
      </Show>
      <StatChip chip={styles.chipAvd} label="AVD" value={`${weaponAvoidancePct(weaponKindOf(props.item))}%`} />
    </>
  );
}

function ArmorSub(props: { item: Item & { kind: "frame" | "barrier" } }) {
  const ceiling = () => armorStatCeiling(props.item);
  const roll = (cur: number, max: number | undefined) => (max !== undefined && max > cur ? `${cur}/${max}` : `${cur}`);
  return (
    <>
      <StatChip chip={styles.chipDfp} label="DFP" value={roll(props.item.dfp, ceiling()?.dfp)} />
      <StatChip chip={styles.chipEvp} label="EVP" value={roll(props.item.evp, ceiling()?.evp)} />
      <Show when={props.item.kind === "frame"}>
        <StatChip chip={styles.chipSlt} label="SLOT" value={(props.item as Item & { kind: "frame" }).unitSlots} />
      </Show>
    </>
  );
}

/**
 * Equip-requirement line, mirroring `canEquip` precedence (ATP → ATA → MST →
 * level): the first unmet requirement wins; when all are met, the first one
 * defined shows. Null for unrestricted items (curated gear) — no line renders.
 */
export function equipReqLine(item: Item, character: Character): { text: string; met: boolean } | null {
  const req = item.requirements;
  if (!req) return null;
  const base = baseStats(character);
  const checks: Array<{ label: string; needed: number | undefined; current: number }> = [
    { label: "ATP", needed: req.atp, current: base.atp },
    { label: "ATA", needed: req.ata, current: base.ata },
    { label: "MST", needed: req.mst, current: base.mst },
    { label: "Lv", needed: req.level, current: character.level },
  ];
  const defined = checks.filter((c) => c.needed !== undefined);
  if (defined.length === 0) return null;
  const shown = defined.find((c) => c.current < c.needed!) ?? defined[0];
  return {
    text: `Req. ${shown.label} ${shown.needed} (${shown.current})`,
    met: shown.current >= shown.needed!,
  };
}

/** Item-aware card: derives icon, name, chip row, and requirement line. */
export function ShopListItem(props: {
  index: number;
  item: Item;
  price: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const ui = useUi();
  const grind = () => (props.item.kind === "weapon" ? props.item.grind : 0);
  const baseName = () => props.item.name;
  return (
    <ShopCard
      index={props.index}
      selected={props.selected}
      onSelect={props.onSelect}
      dataId={props.item.id}
      icon={iconForKind(props.item.kind)}
      rarityClass={`rarity-${props.item.rarity}`}
      name={
        <>
          <span class="name">{baseName()}</span>
          <Show when={grind() > 0}>
            <span class={styles.grind}>+{grind()}</span>
          </Show>
        </>
      }
      sub={
        props.item.kind === "weapon" ? (
          <WeaponSub item={props.item} />
        ) : props.item.kind === "frame" || props.item.kind === "barrier" ? (
          <ArmorSub item={props.item} />
        ) : (
          <span class={styles.summary}>{toolSummary(props.item)}</span>
        )
      }
      price={props.price}
      req={equipReqLine(props.item, ui.selectedChar())}
    />
  );
}

function toolSummary(item: Item): string {
  if (item.kind === "tool" && item.tech !== undefined) {
    return `Technique disk · Lv.${item.techLevel ?? 1}`;
  }
  return "Tool";
}
