/**
 * Non-visual UI constants and formatting helpers shared by the menu-screen
 * components (extracted unchanged from the pre-Solid views.ts).
 */

import { CLASSES, LEVEL_CAP } from "../engine/classes";
import { xpForLevel } from "../engine/progression";
import type { AttackType } from "../engine/combat";
import { CONSUMABLES_LIST, type Supply } from "../engine/consumables";
import type { Item, Weapon } from "../engine/items";
import { specialName } from "../engine/data/item-table";
import type { IconId } from "./icons";

export type Screen = "select" | "create" | "hub";

/** Hub detail panes, one per nav entry (Change Character is navigation). */
export type Pane = "guild" | "weapon-shop" | "armour-shop" | "tool-shop" | "equipment" | "bank";

export const PANE_LABELS: Record<Pane, string> = {
  guild: "Hunter's Guild",
  "weapon-shop": "Weapon Shop",
  "armour-shop": "Armour Shop",
  "tool-shop": "Tool Shop",
  equipment: "Equipment",
  bank: "Inventory/Bank",
};

export const PANES = Object.keys(PANE_LABELS) as Pane[];

/** Equipment-pane slot selector; "units" covers the frame's unit mounts. */
export type EquipSlot = "weapon" | "frame" | "barrier" | "units";

export const SLOT_ICONS: Record<EquipSlot, IconId> = {
  weapon: "saber",
  frame: "frame",
  barrier: "barrier",
  units: "unit",
};

/** BB's canonical class-select order (engine order appends the later classes). */
const CLASS_ORDER = [
  "humar", "hunewearl", "hucast", "hucaseal",
  "ramar", "ramarl", "racast", "racaseal",
  "fomar", "fomarl", "fonewm", "fonewearl",
];
export const CLASSES_CANONICAL = [...CLASSES].sort(
  (a, b) => CLASS_ORDER.indexOf(a.id) - CLASS_ORDER.indexOf(b.id),
);

export const PATTERN_PRESETS: Record<string, AttackType[]> = {
  "Balanced": ["normal", "normal", "heavy"],
  "Aggressive": ["heavy", "heavy", "heavy"],
  "Steady": ["normal", "normal", "normal"],
  "Quick": ["normal", "heavy"],
};

export function patternMeta(pattern: AttackType[]): string {
  return pattern.map((t) => t[0].toUpperCase()).join("-");
}

export function patternName(pattern: AttackType[]): string {
  for (const [name, p] of Object.entries(PATTERN_PRESETS)) {
    if (p.length === pattern.length && p.every((x, i) => x === pattern[i])) return name;
  }
  return patternMeta(pattern);
}

export function supplyLine(supply: Supply): string {
  const parts = CONSUMABLES_LIST.filter((c) => (supply[c.id] ?? 0) > 0).map(
    (c) => `${c.name} ×${supply[c.id]}`,
  );
  return parts.length ? parts.join(", ") : "—";
}

/** PSO-style attribute-bonus tag: [native/aBeast/machine/dark|hit]. */
function bonusesTag(b: NonNullable<Weapon["bonuses"]>): string {
  const pct = (v?: number) => `${v ?? 0}`;
  return `[${pct(b.native)}/${pct(b.aBeast)}/${pct(b.machine)}/${pct(b.dark)}|${pct(b.hit)}]`;
}

function starsTag(item: Item): string {
  return item.stars !== undefined ? ` · ${item.stars}★` : "";
}

export function itemMeta(item: Item): string {
  if (item.kind === "weapon") {
    const parts = [
      `wpn · ATP ${item.minAtp}+${item.spread} · ${Math.round(item.attribute * 100)}% · +${item.grind}/${item.maxGrind}`,
    ];
    if (item.bonuses) parts.push(bonusesTag(item.bonuses));
    const special = item.special !== undefined ? specialName(item.special) : null;
    if (special) parts.push(special);
    return parts.join(" · ") + starsTag(item);
  }
  if (item.kind === "frame") {
    return `frame · DFP ${item.dfp} EVP ${item.evp} · ${item.unitSlots} slots${starsTag(item)}`;
  }
  if (item.kind === "barrier") {
    return `barrier · DFP ${item.dfp} EVP ${item.evp}${starsTag(item)}`;
  }
  if (item.kind === "unit") {
    const bonus = Object.entries(item.bonus)
      .map(([k, v]) => `${k}+${v}`)
      .join(" ");
    return `unit · ${bonus || "—"}${starsTag(item)}`;
  }
  if (item.kind === "tool" && item.tech !== undefined) {
    return `tech disk · Lv.${item.techLevel ?? 1} · unusable for now${starsTag(item)}`;
  }
  return `tool · sells for ${item.sellValue} meseta`;
}

export function xpLine(classId: string, level: number, xp: number): string {
  if (level >= LEVEL_CAP) return `XP ${xp} · max level`;
  const next = xpForLevel(classId, level + 1);
  return `XP ${xp} · ${next - xp} to Lv ${level + 1}`;
}
