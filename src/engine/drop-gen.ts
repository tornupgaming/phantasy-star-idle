/**
 * Authentic PSO drop generation (drop-generation spec).
 *
 * This module owns typed access to the resolved common/rare drop datasets and
 * ports newserv's index-probability sampling to the engine's seeded RNG. Later
 * tasks layer the enemy/box pipelines and item minting on top of these helpers.
 */

import type { SectionId } from "./classes";
import type { ConsumableId } from "./consumables";
import type { Barrier, Frame, Tool, Unit, Weapon, WeaponBonuses } from "./items";
import type { Rng } from "./rng";
import {
  allSpecials,
  allUnits,
  barrierDef,
  frameDef,
  templateFromCode,
  toolDefById,
  unitAttackSpeedBoost,
  unitBonus,
  weaponDef,
} from "./data/item-table";
import commonDropDataset from "./data/common-drop-table.json";
import rareDropDataset from "./data/rare-drop-table.json";

export type DropDifficulty = "Normal" | "Hard" | "Ultimate";

export type CommonItemClass = "weapon" | "armor" | "shield" | "unit" | "tool" | "meseta" | "nothing";

const COMMON_ITEM_CLASSES: Record<number, CommonItemClass> = {
  0: "weapon",
  1: "armor",
  2: "shield",
  3: "unit",
  4: "tool",
  5: "meseta",
  6: "nothing",
};

const BOX_WHERE_BY_AREA_NORM = [
  "Box-Forest1",
  "Box-Forest2",
  "Box-Cave1",
  "Box-Cave2",
  "Box-Cave3",
  "Box-Mine1",
  "Box-Mine2",
  "Box-Ruins1",
  "Box-Ruins2",
  "Box-Ruins3",
] as const;

export interface DropContext {
  difficulty: DropDifficulty;
  sectionId: SectionId;
  areaNorm: number;
}

export type DropPipelineDecision =
  | { kind: "nothing"; reason: "drop-anything-failed" | "empty-box" | "missing-common-class" }
  | { kind: "rare"; where: string; spec: RareDropSpec }
  | { kind: "common"; itemClass: CommonItemClass };

export interface Range {
  min: number;
  max: number;
}

export type ToolDropOutcome =
  | { kind: "consumable"; id: ConsumableId; count: number }
  | { kind: "grinders"; count: number }
  | { kind: "item"; item: Tool }
  | { kind: "nothing" };

export interface EnemyRtIndexDef {
  enemyType: string;
  rtIndex: number;
  rare: boolean;
  boss: boolean;
  displayName: string | null;
  ultimateName: string | null;
}

export interface CommonDropTable {
  ArmorOrShieldTypeBias: number;
  ArmorShieldTypeIndexProbTable: number[];
  ArmorSlotCountProbTable: number[];
  BaseWeaponTypeProbTable: number[];
  BonusTypeProbTable: number[][];
  BonusValueProbTable: number[][];
  BoxItemClassProbTable: number[][];
  BoxMesetaRanges: [number, number][];
  EnemyItemClasses: Record<string, number>;
  EnemyMesetaRanges: Record<string, [number, number]>;
  EnemyTypeDropProbs: Record<string, number>;
  GrindProbTable: number[][];
  HasRareBonusValueProbTable: boolean;
  NonRareBonusProbSpec: number[][];
  SpecialMult: number[];
  SpecialPercent: number[];
  SubtypeAreaLengthTable: number[];
  SubtypeBaseTable: number[];
  ToolClassProbTable: number[][];
  UnitMaxStarsTable: number[];
}

export interface CommonDropDataset {
  episode: "Ep1";
  mode: "Normal";
  difficulties: DropDifficulty[];
  sectionIds: SectionId[];
  techDiskToolClassId: number;
  enemyRtIndex: Record<string, EnemyRtIndexDef>;
  tables: Record<DropDifficulty, Record<SectionId, CommonDropTable>>;
}

export interface RareDropSpec {
  probability: number;
  probabilityRaw: number | string;
  code: string;
  kind: "weapon" | "frame" | "barrier" | "unit";
}

export interface RareDropDataset {
  episode: "Ep1";
  mode: "Normal";
  difficulties: DropDifficulty[];
  sectionIds: SectionId[];
  retainedWhereKeys: string[];
  tables: Record<DropDifficulty, Record<SectionId, Record<string, RareDropSpec[]>>>;
}

export const COMMON_DROP_DATA = commonDropDataset as unknown as CommonDropDataset;
export const RARE_DROP_DATA = rareDropDataset as unknown as RareDropDataset;

export function commonDropTable(difficulty: DropDifficulty, sectionId: SectionId): CommonDropTable {
  const table = COMMON_DROP_DATA.tables[difficulty]?.[sectionId];
  if (!table) throw new Error(`missing common drop table for ${difficulty}/${sectionId}`);
  return table;
}

export function rareDropSpecs(
  difficulty: DropDifficulty,
  sectionId: SectionId,
  where: string,
): readonly RareDropSpec[] {
  return RARE_DROP_DATA.tables[difficulty]?.[sectionId]?.[where] ?? [];
}

export function enemyRtIndex(statsType: string): EnemyRtIndexDef | null {
  return COMMON_DROP_DATA.enemyRtIndex[statsType] ?? null;
}

export function rangeFromTuple(tuple: [number, number]): Range {
  return { min: tuple[0], max: tuple[1] };
}

export function boxWhereForAreaNorm(areaNorm: number): string {
  const where = BOX_WHERE_BY_AREA_NORM[areaNorm];
  if (where === undefined) throw new Error(`no rare-table box key for area_norm ${areaNorm}`);
  return where;
}

function itemClassForValue(value: number | undefined): CommonItemClass | null {
  if (value === undefined) return null;
  return COMMON_ITEM_CLASSES[value] ?? "nothing";
}

function rollRareSpec(specs: readonly RareDropSpec[], rng: Rng): RareDropSpec | null {
  for (const spec of specs) {
    if (rng.chance(spec.probability)) return spec;
  }
  return null;
}

export function rollEnemyDropPipeline(statsType: string, context: DropContext, rng: Rng): DropPipelineDecision {
  const table = commonDropTable(context.difficulty, context.sectionId);
  const dropProbPercent = table.EnemyTypeDropProbs[statsType] ?? 0;
  if (!rng.chance(dropProbPercent / 100)) {
    return { kind: "nothing", reason: "drop-anything-failed" };
  }

  const rare = rollRareSpec(rareDropSpecs(context.difficulty, context.sectionId, statsType), rng);
  if (rare) return { kind: "rare", where: statsType, spec: rare };

  const itemClass = itemClassForValue(table.EnemyItemClasses[statsType]);
  return itemClass ? { kind: "common", itemClass } : { kind: "nothing", reason: "missing-common-class" };
}

export function rollBoxDropPipeline(context: DropContext, rng: Rng): DropPipelineDecision {
  const where = boxWhereForAreaNorm(context.areaNorm);
  const rare = rollRareSpec(rareDropSpecs(context.difficulty, context.sectionId, where), rng);
  if (rare) return { kind: "rare", where, spec: rare };

  const table = commonDropTable(context.difficulty, context.sectionId);
  const sampled = sampleWeightedColumn(table.BoxItemClassProbTable, context.areaNorm, rng);
  const itemClass = itemClassForValue(sampled ?? undefined);
  if (!itemClass || itemClass === "nothing") return { kind: "nothing", reason: "empty-box" };
  return { kind: "common", itemClass };
}

function hexByte(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function generatedWeaponCode(weaponType: number, subtype: number): string {
  return `00${hexByte(weaponType)}${hexByte(subtype)}`;
}

function weaponTypeWeightsForArea(table: CommonDropTable, areaNorm: number): number[] {
  const weights = [0, ...table.BaseWeaponTypeProbTable];
  for (let weaponType = 1; weaponType <= 12; weaponType++) {
    if (areaNorm + table.SubtypeBaseTable[weaponType - 1] < 0) weights[weaponType] = 0;
  }
  return weights;
}

function rollWeaponBonusValue(table: CommonDropTable, spec: number, rng: Rng): number | null {
  const index = sampleWeightedColumn(table.BonusValueProbTable, spec, rng);
  if (index === null) return null;
  return -10 + index * 5;
}

function rollWeaponBonuses(table: CommonDropTable, areaNorm: number, rng: Rng): WeaponBonuses | undefined {
  const bonuses: WeaponBonuses = {};
  const bonusKeys = [null, "native", "aBeast", "machine", "dark", "hit"] as const;
  for (let bonusSlot = 0; bonusSlot < table.NonRareBonusProbSpec.length; bonusSlot++) {
    const spec = table.NonRareBonusProbSpec[bonusSlot][areaNorm];
    if (spec === 0xff) continue;
    const bonusType = sampleWeightedColumn(table.BonusTypeProbTable, areaNorm, rng);
    const key = bonusType === null ? null : bonusKeys[bonusType];
    if (!key || bonuses[key] !== undefined) continue;
    const value = rollWeaponBonusValue(table, spec, rng);
    if (value !== null && value !== 0) bonuses[key] = value;
  }
  return Object.keys(bonuses).length > 0 ? bonuses : undefined;
}

function chooseWeaponSpecial(table: CommonDropTable, areaNorm: number, rng: Rng): number | undefined {
  const specialMult = table.SpecialMult[areaNorm];
  if (specialMult <= 0) return undefined;
  if (!rng.chance(table.SpecialPercent[areaNorm] / 100)) return undefined;
  const tier = Math.trunc(rng.float(0, specialMult));
  if (tier >= 4) return undefined;

  const eligible = allSpecials().filter((special) => special.index > 0 && special.stars === tier + 1);
  if (eligible.length === 0) return undefined;
  return rng.pick(eligible).index;
}

export function generateCommonWeapon(context: DropContext, rng: Rng, mintId: () => string): Weapon | null {
  const table = commonDropTable(context.difficulty, context.sectionId);
  const weaponType = sampleWeightedIndex(weaponTypeWeightsForArea(table, context.areaNorm), rng);
  if (!weaponType) return null;

  const subtypeBase = table.SubtypeBaseTable[weaponType - 1];
  const areaLength = table.SubtypeAreaLengthTable[weaponType - 1];
  if (areaLength <= 0) throw new Error(`weapon type ${weaponType} has invalid subtype area length ${areaLength}`);

  let subtype: number;
  let offsetWithinSubtypeRange: number;
  if (subtypeBase < 0) {
    const shifted = context.areaNorm + subtypeBase;
    if (shifted < 0) return null;
    subtype = Math.trunc(shifted / areaLength);
    offsetWithinSubtypeRange = shifted - subtype * areaLength;
  } else {
    subtype = subtypeBase + Math.trunc(context.areaNorm / areaLength);
    offsetWithinSubtypeRange = context.areaNorm - Math.trunc(context.areaNorm / areaLength) * areaLength;
  }

  const code = generatedWeaponCode(weaponType, subtype);
  const def = weaponDef(code);
  if (!def) throw new Error(`generated weapon code ${code} does not exist in item table`);

  const grindColumn = Math.max(0, Math.min(3, offsetWithinSubtypeRange));
  const grind = Math.min(sampleWeightedColumn(table.GrindProbTable, grindColumn, rng) ?? 0, def.maxGrind);
  const weapon = { ...(templateFromCode(code) as Omit<Weapon, "id">), id: mintId(), grind };
  const bonuses = rollWeaponBonuses(table, context.areaNorm, rng);
  if (bonuses) weapon.bonuses = bonuses;
  const special = chooseWeaponSpecial(table, context.areaNorm, rng);
  if (special !== undefined) weapon.special = special;
  return weapon;
}

function armorOrShieldSubtype(table: CommonDropTable, areaNorm: number, rng: Rng): number {
  const typeRoll = sampleWeightedIndex(table.ArmorShieldTypeIndexProbTable, rng) ?? 0;
  return Math.max(areaNorm + typeRoll + table.ArmorOrShieldTypeBias - 3, 0);
}

export function generateCommonFrame(context: DropContext, rng: Rng, mintId: () => string): Frame | null {
  const table = commonDropTable(context.difficulty, context.sectionId);
  const subtype = armorOrShieldSubtype(table, context.areaNorm, rng);
  const code = `0101${hexByte(subtype)}`;
  const def = frameDef(code);
  if (!def) return null;
  const slots = sampleWeightedIndex(table.ArmorSlotCountProbTable, rng) ?? 0;
  return {
    ...(templateFromCode(code) as Omit<Frame, "id">),
    id: mintId(),
    dfp: def.dfp + Math.trunc(def.dfpRange * rng.next()),
    evp: def.evp + Math.trunc(def.evpRange * rng.next()),
    unitSlots: slots,
    slots,
  };
}

export function generateCommonBarrier(context: DropContext, rng: Rng, mintId: () => string): Barrier | null {
  const table = commonDropTable(context.difficulty, context.sectionId);
  const subtype = armorOrShieldSubtype(table, context.areaNorm, rng);
  const code = `0102${hexByte(subtype)}`;
  const def = barrierDef(code);
  if (!def) return null;
  return {
    ...(templateFromCode(code) as Omit<Barrier, "id">),
    id: mintId(),
    dfp: def.dfp + Math.trunc(def.dfpRange * rng.next()),
    evp: def.evp + Math.trunc(def.evpRange * rng.next()),
  };
}

export function generateCommonUnit(context: DropContext, rng: Rng, mintId: () => string): Unit | null {
  const table = commonDropTable(context.difficulty, context.sectionId);
  const maxStars = table.UnitMaxStarsTable[context.areaNorm];
  const candidates = allUnits().filter((unit) => unit.stars < maxStars);
  if (candidates.length === 0) return null;
  const def = rng.pick(candidates);
  return {
    ...(templateFromCode(def.code) as Omit<Unit, "id">),
    id: mintId(),
    bonus: unitBonus(def),
    attackSpeedBoost: unitAttackSpeedBoost(def) || undefined,
  };
}

function consumableForToolCode(code: string): ConsumableId | null {
  switch (code) {
    case "030000":
      return "monomate";
    case "030001":
      return "dimate";
    case "030002":
      return "trimate";
    case "030400":
      return "moon-atomizer";
    default:
      return null;
  }
}

function grinderCountForToolCode(code: string): number {
  switch (code) {
    case "030A00":
      return 1;
    case "030A01":
      return 2;
    case "030A02":
      return 3;
    default:
      return 0;
  }
}

function rollRareWeaponBonuses(table: CommonDropTable, rng: Rng): WeaponBonuses | undefined {
  const bonuses: WeaponBonuses = {};
  const bonusKeys = [null, "native", "aBeast", "machine", "dark", "hit"] as const;
  const randomAreaColumn = rng.int(0, 9);
  for (let slot = 0; slot < 3; slot++) {
    const bonusType = sampleWeightedColumn(table.BonusTypeProbTable, randomAreaColumn, rng);
    const key = bonusType === null ? null : bonusKeys[bonusType];
    if (!key || bonuses[key] !== undefined) continue;
    const value = rollWeaponBonusValue(table, 5, rng);
    if (value !== null && value !== 0) bonuses[key] = value;
  }
  return Object.keys(bonuses).length > 0 ? bonuses : undefined;
}

export function mintRareItem(spec: RareDropSpec, context: DropContext, rng: Rng, mintId: () => string): Weapon | Frame | Barrier | Unit {
  const template = templateFromCode(spec.code);
  switch (template.kind) {
    case "weapon": {
      const item: Weapon = { ...template, id: mintId(), rarity: "rare", grind: 0 };
      const bonuses = rollRareWeaponBonuses(commonDropTable(context.difficulty, context.sectionId), rng);
      if (bonuses) item.bonuses = bonuses;
      return item;
    }
    case "frame":
      return { ...template, id: mintId(), rarity: "rare" };
    case "barrier":
      return { ...template, id: mintId(), rarity: "rare" };
    case "unit":
      return { ...template, id: mintId(), rarity: "rare" };
  }
}

export function generateCommonTool(context: DropContext, rng: Rng, mintId: () => string): ToolDropOutcome {
  const table = commonDropTable(context.difficulty, context.sectionId);
  const toolClass = sampleWeightedColumn(table.ToolClassProbTable, context.areaNorm, rng);
  if (toolClass === null) return { kind: "nothing" };
  const def = toolDefById(toolClass);
  if (!def) return { kind: "nothing" };

  const consumable = consumableForToolCode(def.code);
  if (consumable) return { kind: "consumable", id: consumable, count: 1 };
  const grinders = grinderCountForToolCode(def.code);
  if (grinders > 0) return { kind: "grinders", count: grinders };
  return {
    kind: "item",
    item: {
      kind: "tool",
      id: mintId(),
      defId: def.code,
      code: def.code,
      stars: def.stars,
      name: def.name ?? def.code,
      rarity: "common",
      sellValue: def.sellValue,
    },
  };
}

export function rollEnemyMeseta(statsType: string, context: DropContext, rng: Rng, mesetaMult: number): number {
  const range = commonDropTable(context.difficulty, context.sectionId).EnemyMesetaRanges[statsType];
  if (!range) return 0;
  return Math.floor(rng.int(range[0], range[1]) * mesetaMult);
}

export function rollBoxMeseta(context: DropContext, rng: Rng, mesetaMult: number): number {
  const range = commonDropTable(context.difficulty, context.sectionId).BoxMesetaRanges[context.areaNorm];
  if (!range) return 0;
  return Math.floor(rng.int(range[0], range[1]) * mesetaMult);
}

/**
 * Port of newserv's get_rand_from_weighted_tables for one-dimensional index
 * probability tables. Values are weights for their own index and need not sum
 * to 100. Zero/negative weights are ignored; an all-zero table has no result.
 */
export function sampleWeightedIndex(weights: readonly number[], rng: Rng): number | null {
  let total = 0;
  for (const weight of weights) {
    if (!Number.isFinite(weight)) throw new Error(`non-finite weight ${weight}`);
    if (weight > 0) total += Math.trunc(weight);
  }
  if (total <= 0) return null;
  let roll = rng.int(0, total - 1);
  for (let index = 0; index < weights.length; index++) {
    const weight = Math.max(0, Math.trunc(weights[index]));
    if (roll < weight) return index;
    roll -= weight;
  }
  return weights.length - 1;
}

/** Sample a vertical column from a 2D index-probability table: table[index][column]. */
export function sampleWeightedColumn(table: readonly (readonly number[])[], column: number, rng: Rng): number | null {
  return sampleWeightedIndex(
    table.map((row, rowIndex) => {
      if (column < 0 || column >= row.length) {
        throw new Error(`column ${column} out of range for weighted row ${rowIndex}`);
      }
      return row[column];
    }),
    rng,
  );
}
