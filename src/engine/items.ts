/**
 * Item / equipment types (task 2.2).
 *
 * Four equippable gear kinds: weapon, frame (body armor), barrier (shield), unit
 * (stat module), plus inert tool items for non-usable tool drops. Consumables
 * (task 5) are a separate stock, not inventory gear.
 *
 * Weapon fields map onto the damage formula (combat-resolution spec):
 *   EQATP = WATP,min×(1+Watr) + Grind×2 + FATP + BaATP
 * where WATP,min = `minAtp`, Watr = `attribute`, Grind = `grind`, FATP = frame
 * `atp`, BaATP = barrier `atp`. `spread` (WSpread) feeds the per-attack `Wvar×WSpread`.
 */

import type { Stats } from "./stats";

/**
 * Coarse weapon archetype. Timing comes from the authentic frame data keyed by
 * `weaponKind`; this survives as a display label and as the timing fallback
 * for weapons that predate the item port (curated gear, old saves) and carry
 * no `weaponKind`.
 */
export type WeaponType =
  | "saber" // fast, weak
  | "sword" // slow, strong
  | "handgun" // ranged, fast
  | "rifle" // ranged, slow, accurate
  | "cane"; // caster frame (techs deferred; still a valid melee weapon here)

export type ItemKind = "weapon" | "frame" | "barrier" | "unit" | "tool";
export type Rarity = "common" | "uncommon" | "rare";

export interface WeaponBonuses {
  native?: number;
  aBeast?: number;
  machine?: number;
  dark?: number;
  hit?: number;
}

/**
 * Authentic PSO animation categories (`WeaponKind` in the item table, 0..18) —
 * index order matches the source data. Frame-data attack timing keys off these.
 */
export const WEAPON_KIND_NAMES = [
  "fist", "saber", "sword", "dagger", "partisan", "slicer", "handgun",
  "rifle", "mechgun", "shot", "cane", "rod", "wand", "claw", "double-saber",
  "twin-sword", "katana", "launcher", "card",
] as const;

export type WeaponKindName = (typeof WEAPON_KIND_NAMES)[number];

/**
 * Representative animation category per coarse archetype — the timing fallback
 * for weapons without a `weaponKind`.
 */
export const KIND_FOR_ARCHETYPE: Record<WeaponType, number> = {
  saber: 1,
  sword: 2,
  handgun: 6,
  rifle: 7,
  cane: 10,
};

/**
 * Resolve a weapon to its authentic animation category: the item's own
 * `weaponKind` when the table provides one, else the coarse archetype's
 * representative kind (curated/legacy weapons); `null` means barehanded.
 * Single source for the run loop and every UI stat display.
 */
export function weaponKindOf(
  weapon: Pick<Weapon, "weaponKind" | "weaponType"> | null | undefined,
): number | null {
  if (!weapon) return null;
  return weapon.weaponKind ?? KIND_FOR_ARCHETYPE[weapon.weaponType];
}

/**
 * Coarse display archetype for an authentic animation category (0..18),
 * grouped by tempo. Label only — timing reads the frame data directly.
 */
export const ARCHETYPE_FOR_KIND: Record<WeaponKindName, WeaponType> = {
  // fast melee
  fist: "saber",
  saber: "saber",
  dagger: "saber",
  claw: "saber",
  "twin-sword": "saber",
  katana: "saber",
  // slow melee
  sword: "sword",
  partisan: "sword",
  // medium (melee-ish / thrown / caster)
  slicer: "cane",
  cane: "cane",
  rod: "cane",
  wand: "cane",
  "double-saber": "cane",
  card: "cane",
  // fast ranged
  handgun: "handgun",
  mechgun: "handgun",
  // slow ranged
  rifle: "rifle",
  shot: "rifle",
  launcher: "rifle",
};

/** Coarse display archetype for an authentic animation category (0..18). */
export function archetypeForWeaponKind(weaponKind: number): WeaponType {
  const name = WEAPON_KIND_NAMES[weaponKind];
  if (name === undefined) {
    throw new Error(`unknown WeaponKind ${weaponKind}`);
  }
  return ARCHETYPE_FOR_KIND[name];
}

/**
 * Equip requirements (item-parameter-data spec). Stat requirements check the
 * character's BASE stats (authentic PSO behavior — equipment bonuses don't
 * count); `usableBy` is newserv's attribute bitmask (bits: 01 hunter,
 * 02 ranger, 04 force, 08 human, 10 android, 20 newman, 40 male, 80 female —
 * ALL of the character's attribute bits must be set to equip). Items without
 * requirements equip unconditionally.
 */
export interface EquipRequirements {
  atp?: number;
  ata?: number;
  mst?: number;
  level?: number;
  usableBy?: number;
}

interface ItemBase {
  id: string; // unique instance id
  defId: string; // definition/template id (for stacking, drop tables)
  name: string;
  rarity: Rarity;
  /** Base sell value in meseta; feeds the loot filter and shop. */
  sellValue: number;
  /** Equip gating (absent on curated gear, which equips unconditionally). */
  requirements?: EquipRequirements;
  /** Authentic PSO 3-byte item code (TTGGII), present on generated/authentic items. */
  code?: string;
  /** Raw PMT star value; rarity is derived from this for generated/authentic items. */
  stars?: number;
}

export interface Weapon extends ItemBase {
  kind: "weapon";
  weaponType: WeaponType;
  minAtp: number; // WATP,min
  spread: number; // WSpread (max ATP − min ATP)
  attribute: number; // Watr, fraction 0..~1 (applied only to minAtp)
  ata: number; // weapon accuracy bonus
  grind: number; // current grind, 0..maxGrind
  maxGrind: number;
  /** Authentic PSO weapon group byte (item-table weapons only). */
  group?: number;
  /** Authentic animation category 0..18 (drives the pacing archetype lookup). */
  weaponKind?: number;
  /** Generated PSO area/hit attribute bonuses; stored/displayed but combat-inert for now. */
  bonuses?: WeaponBonuses;
  /** Generated PSO special ability tier/id; stored/displayed but combat-inert for now. */
  special?: number;
  /**
   * Identified state. All current mints (shop and drops) are tekked; untekked
   * drops and the tekker are future changes. Absent on legacy items = tekked.
   */
  tekked?: boolean;
}

export interface Frame extends ItemBase {
  kind: "frame";
  dfp: number;
  evp: number;
  atp?: number; // FATP (usually 0)
  unitSlots: number; // how many units this frame accepts
  /** Generated slot count. Mirrors unitSlots for generated frames; optional for legacy items. */
  slots?: number;
}

export interface Barrier extends ItemBase {
  kind: "barrier";
  dfp: number;
  evp: number;
  atp?: number; // BaATP (usually 0)
  /** Reserved for generated shield variance; shields normally have no unit slots. */
  slots?: number;
}

export interface Unit extends ItemBase {
  kind: "unit";
  /** Flat stat bonuses granted while equipped. */
  bonus: Partial<Stats>;
  /**
   * Attack-speed boost percent (…/Battle series, V101). Interpolates attack
   * timings toward the +40% frame-data anchor; highest equipped unit wins.
   */
  attackSpeedBoost?: number;
}

export interface Tool extends ItemBase {
  kind: "tool";
  /** Technique number for tech disks (0302xx); inert until techniques exist. */
  tech?: number;
  /** Tech disk level, 1-based display value. */
  techLevel?: number;
}

/** Missing tekked field (legacy saves, pre-field mints) reads as identified. */
export function isTekked(weapon: Weapon): boolean {
  return weapon.tekked !== false;
}

export type Item = Weapon | Frame | Barrier | Unit | Tool;

export function isWeapon(item: Item): item is Weapon {
  return item.kind === "weapon";
}
export function isFrame(item: Item): item is Frame {
  return item.kind === "frame";
}
export function isBarrier(item: Item): item is Barrier {
  return item.kind === "barrier";
}
export function isUnit(item: Item): item is Unit {
  return item.kind === "unit";
}
export function isTool(item: Item): item is Tool {
  return item.kind === "tool";
}

