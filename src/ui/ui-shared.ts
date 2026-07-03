/**
 * Non-visual UI constants and formatting helpers shared by the menu-screen
 * components (extracted unchanged from the pre-Solid views.ts).
 */

import { CLASSES, LEVEL_CAP } from "../engine/classes";
import { xpForLevel } from "../engine/progression";
import type { AttackType } from "../engine/combat";
import { CONSUMABLES_LIST, type Supply } from "../engine/consumables";
import type { Item } from "../engine/items";
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

export function itemMeta(item: Item): string {
  return item.kind === "weapon"
    ? `wpn · ATP ${item.minAtp}+${item.spread} · ${Math.round(item.attribute * 100)}% · +${item.grind}/${item.maxGrind}`
    : item.kind === "frame"
      ? `frame · DFP ${item.dfp} EVP ${item.evp} · ${item.unitSlots} slots`
      : item.kind === "barrier"
        ? `barrier · DFP ${item.dfp} EVP ${item.evp}`
        : `unit · ${Object.entries(item.bonus)
            .map(([k, v]) => `${k}+${v}`)
            .join(" ")}`;
}

export function xpLine(classId: string, level: number, xp: number): string {
  if (level >= LEVEL_CAP) return `XP ${xp} · max level`;
  const next = xpForLevel(classId, level + 1);
  return `XP ${xp} · ${next - xp} to Lv ${level + 1}`;
}
