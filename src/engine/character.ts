/**
 * Character model + equipment (tasks 2.3, 2.4; add-character-roster).
 *
 * A character is an identity (name, class, section ID — class and section ID
 * are immutable after creation), progression (level/XP), and equipped gear.
 * Base stats are DERIVED from class + level (see progression.ts), never
 * stored; they change only through leveling, which applies at run resolution.
 * Equip/unequip validate slots and the frame's unit-slot limit. Grinding
 * raises a weapon's grind toward its max, consuming a grinder (accounted by
 * the caller — see loot/shop).
 */

import type { Stats } from "./stats";
import { sumStats } from "./stats";
import type { Weapon, Frame, Barrier, Unit } from "./items";
import type { Combatant } from "./combat";
import { CLASS_EQUIP_MASK, type SectionId } from "./classes";
import { classById, statsAtLevel, levelForXp } from "./progression";

export interface Equipment {
  weapon: Weapon | null;
  frame: Frame | null;
  barrier: Barrier | null;
  units: Unit[];
}

export interface Character {
  id: string;
  name: string;
  classId: string; // immutable after creation
  sectionId: SectionId; // immutable after creation; inert until the drop-table port
  level: number;
  xp: number;
  equipment: Equipment;
}

/** Derived base stats: class base + growth to the current level (see progression). */
export function baseStats(character: Character): Stats {
  return statsAtLevel(character.classId, character.level);
}

/** Profession ATP variance range (Pvar); drawn 0..pvar each attack. Class-derived. */
export function characterPvar(character: Character): number {
  return classById(character.classId).pvar;
}

/**
 * Apply XP earned by a run at resolution time (never mid-run; the run itself
 * uses its dispatch-time snapshot). Returns levels gained.
 */
export function applyRunXp(character: Character, xpGained: number): { levelsGained: number } {
  const before = character.level;
  character.xp += Math.max(0, Math.floor(xpGained));
  const newLevel = levelForXp(character.classId, character.xp);
  if (newLevel > character.level) character.level = newLevel;
  return { levelsGained: character.level - before };
}

export function emptyEquipment(): Equipment {
  return { weapon: null, frame: null, barrier: null, units: [] };
}

/** Max units currently allowed = the equipped frame's unit slots (0 if no frame). */
export function unitCapacity(eq: Equipment): number {
  return eq.frame?.unitSlots ?? 0;
}

/**
 * Effective combat stats = base + gear contributions. Note the weapon's own ATP is
 * NOT folded in here — it enters combat via EQATP in the damage formula. Weapon
 * `ata`, however, is a direct accuracy contribution.
 */
export function effectiveStats(character: Character): Stats {
  const eq = character.equipment;
  const parts: Array<Partial<Stats>> = [baseStats(character)];

  if (eq.frame) parts.push({ dfp: eq.frame.dfp, evp: eq.frame.evp });
  if (eq.barrier) parts.push({ dfp: eq.barrier.dfp, evp: eq.barrier.evp });
  if (eq.weapon) parts.push({ ata: eq.weapon.ata });
  for (const unit of eq.units) parts.push(unit.bonus);

  return sumStats(parts);
}

/**
 * Attack-speed boost percent from equipped units (…/Battle series, V101).
 * Only the highest single unit applies — boosts do not stack
 * (character-equipment spec). Works on any Equipment, so previews can pass
 * `previewEquipment(...)` results.
 */
export function attackSpeedBoost(eq: Equipment): number {
  return eq.units.reduce((best, u) => Math.max(best, u.attackSpeedBoost ?? 0), 0);
}

/** EQATP = WATP,min×(1+Watr) + Grind×2 + FATP + BaATP (attribute on min ATP only). */
export function equipmentAtp(eq: Equipment): number {
  if (!eq.weapon) return 0;
  const w = eq.weapon;
  const weaponAtp = w.minAtp * (1 + w.attribute) + w.grind * 2;
  return weaponAtp + (eq.frame?.atp ?? 0) + (eq.barrier?.atp ?? 0);
}

/** Build the combat-ready Combatant view of the character (uses effective stats + EQATP). */
export function characterToCombatant(character: Character): Combatant {
  const s = effectiveStats(character);
  const eq = character.equipment;
  return {
    name: character.name,
    atp: s.atp,
    dfp: s.dfp,
    ata: s.ata,
    evp: s.evp,
    lck: s.lck,
    eqAtp: equipmentAtp(eq),
    spread: eq.weapon?.spread ?? 0,
    pvarMax: characterPvar(character),
    critDivisor: 5, // character crit rate = LCK/5 %
  };
}

/**
 * The equipment a character would carry after an equip/unequip, without
 * mutating anything (pioneer2-hub-redesign). For weapon/frame/barrier, `item`
 * replaces the slot (null empties it); swapping to a frame with fewer unit
 * slots trims excess units from the end, mirroring `equip`. For units, `item`
 * is added only when capacity remains (otherwise the equipment is returned
 * unchanged), and `removeUnitId` removes that unit instead.
 */
export function previewEquipment(
  character: Character,
  slot: "weapon" | "frame" | "barrier" | "unit",
  item: Weapon | Frame | Barrier | Unit | null,
  removeUnitId?: string,
): Equipment {
  const eq = character.equipment;
  if (slot === "unit") {
    if (removeUnitId !== undefined) {
      return { ...eq, units: eq.units.filter((u) => u.id !== removeUnitId) };
    }
    if (item && eq.units.length < unitCapacity(eq)) {
      return { ...eq, units: [...eq.units, item as Unit] };
    }
    return { ...eq, units: [...eq.units] };
  }
  const next: Equipment = { ...eq, units: [...eq.units], [slot]: item };
  const cap = unitCapacity(next);
  if (next.units.length > cap) next.units = next.units.slice(0, cap);
  return next;
}

/**
 * Effective stats as-if the given equip/unequip had been performed — a pure
 * preview for the PSO-style equip flow; the character is untouched.
 */
export function previewStats(
  character: Character,
  slot: "weapon" | "frame" | "barrier" | "unit",
  item: Weapon | Frame | Barrier | Unit | null,
  removeUnitId?: string,
): Stats {
  return effectiveStats({ ...character, equipment: previewEquipment(character, slot, item, removeUnitId) });
}

export type EquipResult = { ok: true } | { ok: false; reason: string };

/**
 * Equip-requirement check (item-parameter-data / character-equipment specs).
 * Stat requirements test BASE stats — authentic PSO behavior; equipment
 * bonuses never satisfy them. `usableBy` is the newserv attribute bitmask:
 * every attribute bit of the character's class must be set on the item.
 * Items without `requirements` (all curated gear) always pass.
 */
export function meetsRequirements(
  character: Character,
  item: Weapon | Frame | Barrier | Unit,
): EquipResult {
  const req = item.requirements;
  if (!req) return { ok: true };
  const base = baseStats(character);
  if (req.atp !== undefined && base.atp < req.atp) return { ok: false, reason: `requires ${req.atp} ATP` };
  if (req.ata !== undefined && base.ata < req.ata) return { ok: false, reason: `requires ${req.ata} ATA` };
  if (req.mst !== undefined && base.mst < req.mst) return { ok: false, reason: `requires ${req.mst} MST` };
  if (req.level !== undefined && character.level < req.level) {
    return { ok: false, reason: `requires level ${req.level}` };
  }
  if (req.usableBy !== undefined) {
    const classMask = CLASS_EQUIP_MASK[character.classId];
    if (classMask === undefined || (req.usableBy & classMask) !== classMask) {
      return { ok: false, reason: "cannot be equipped by this class" };
    }
  }
  return { ok: true };
}

/** Equip a weapon/frame/barrier into its single slot, or add a unit within capacity. */
export function equip(character: Character, item: Weapon | Frame | Barrier | Unit): EquipResult {
  const gate = meetsRequirements(character, item);
  if (!gate.ok) return gate;
  const eq = character.equipment;
  switch (item.kind) {
    case "weapon":
      eq.weapon = item;
      return { ok: true };
    case "frame": {
      eq.frame = item;
      // Shrinking unit capacity may orphan excess units; trim from the end.
      const cap = unitCapacity(eq);
      if (eq.units.length > cap) eq.units = eq.units.slice(0, cap);
      return { ok: true };
    }
    case "barrier":
      eq.barrier = item;
      return { ok: true };
    case "unit": {
      const cap = unitCapacity(eq);
      if (eq.units.length >= cap) {
        return { ok: false, reason: cap === 0 ? "no frame equipped" : "no free unit slot" };
      }
      eq.units.push(item);
      return { ok: true };
    }
  }
}

/** Unequip a slot; for units pass the unit id. Returns the removed item, if any. */
export function unequip(
  character: Character,
  slot: "weapon" | "frame" | "barrier",
): Weapon | Frame | Barrier | null;
export function unequip(character: Character, slot: "unit", unitId: string): Unit | null;
export function unequip(
  character: Character,
  slot: "weapon" | "frame" | "barrier" | "unit",
  unitId?: string,
): Weapon | Frame | Barrier | Unit | null {
  const eq = character.equipment;
  if (slot === "unit") {
    const idx = eq.units.findIndex((u) => u.id === unitId);
    if (idx < 0) return null;
    const [removed] = eq.units.splice(idx, 1);
    return removed;
  }
  const removed = eq[slot];
  eq[slot] = null;
  return removed;
}

/**
 * Weapon grinding (task 2.4). Increases grind by 1 up to maxGrind. Returns whether
 * a grinder was consumed; refuses (and consumes nothing) at max grind.
 */
export function grindWeapon(weapon: Weapon): EquipResult {
  if (weapon.grind >= weapon.maxGrind) {
    return { ok: false, reason: "already at maximum grind" };
  }
  weapon.grind += 1;
  return { ok: true };
}
