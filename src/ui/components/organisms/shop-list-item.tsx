/**
 * Item-aware shop card (shop-list-card spec): derives icon, name, per-kind
 * chip stat row, and equip-requirement line from an engine `Item`, rendered
 * on the presentational `ShopCard` molecule.
 */

import { Show } from "solid-js";

import { baseStats, type Character } from "../../../engine/character";
import { weaponAvoidancePct } from "../../../engine/data/avoidance";
import { armorStatCeiling } from "../../../engine/data/item-table";
import { weaponKindOf, type Item, type Weapon } from "../../../engine/items";
import { iconForKind } from "../../icons";
import { useUi } from "../../context";
import { ShopCard, StatChip } from "../molecules/shop-card";
import styles from "../molecules/shop-card.module.css";

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
