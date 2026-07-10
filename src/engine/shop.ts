/**
 * Authentic BB shop generation + purchasing (shop-generation spec).
 *
 * Ports newserv's `ItemCreator::generate_{armor,tool,weapon}_shop_contents`
 * (src/ItemCreator.cc:1007-1545) onto the engine's seeded RNG and the extracted
 * shop random-set dataset (data/shop-tables.ts). Level-tiered weighted tables
 * drive the picks; grinds/specials/bonuses/slots roll per the source, including
 * its clamp-low-only quirks. Prices come from the authentic formulas
 * (pricing.ts); purchases are rejected when meseta is insufficient.
 *
 * Shop difficulty derives from character level (0-19 Normal, 20-39 Hard,
 * 40-79 Very Hard, 80+ Ultimate) — a documented concession: PSO keys shops off
 * the hosting game's difficulty, which an idle hub doesn't have. Stock is a
 * pure function of (shop kind, characterId, level) and restocks on level-up.
 */

import type { EconomyState } from "./loot";
import type { Item, Weapon, Frame, Barrier, Unit, Tool, WeaponBonuses } from "./items";
import type { Supply, ConsumableId } from "./consumables";
import { CONSUMABLES, CONSUMABLES_LIST, addToSupply } from "./consumables";
import type { SectionId } from "./classes";
import { createRng, type Rng } from "./rng";
import type { DropDifficulty } from "./drop-gen";
import { commonDropTable, sampleWeightedIndex } from "./drop-gen";
import { priceForItem } from "./pricing";
import {
  SHOP_TABLES,
  TOOL_SHOP_NOTHING,
  sectionIdIndex,
  toolCodeForEntry,
  weaponCodeForTypeCode,
  weaponShopTables,
  type Range,
  type TechDiskLevelMode,
  type WeightedEntry,
} from "./data/shop-tables";
import {
  allSpecials,
  frameDef,
  templateFromCode,
  toolDef,
  weaponDef,
} from "./data/item-table";

/** Authentic Monogrinder price (PMT tool cost; grinders sell as a flat count). */
export const MONOGRINDER_CODE = "030A00";
export const GRINDER_PRICE = toolDef(MONOGRINDER_CODE)!.cost;

const hexByte = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();

// ---- Shop difficulty from character level ------------------------------------

export function shopDifficulty(level: number): DropDifficulty {
  if (level < 20) return "Normal";
  if (level < 40) return "Hard";
  if (level < 80) return "VeryHard";
  return "Ultimate";
}

// ---- ProbabilityTable (ItemCreator.cc:12-67) ----------------------------------

/**
 * newserv expands every [value, weight] row into a flat multiset, Fisher-Yates
 * shuffles it forward (z ascending, swap with rand % (z+1)), then pops from the
 * END. Reproduced exactly (modulo our own RNG stream).
 */
export class ProbabilityTable {
  private items: number[] = [];

  constructor(entries: readonly WeightedEntry[]) {
    for (const [value, weight] of entries) {
      for (let i = 0; i < weight; i++) this.items.push(value);
    }
  }

  get size(): number {
    return this.items.length;
  }

  shuffle(rng: Rng): void {
    for (let z = 1; z < this.items.length; z++) {
      const other = rng.int(0, z);
      const tmp = this.items[z];
      this.items[z] = this.items[other];
      this.items[other] = tmp;
    }
  }

  pop(): number | null {
    return this.items.length > 0 ? (this.items.pop() as number) : null;
  }
}

// ---- Stock shapes --------------------------------------------------------------

/** The three Pioneer 2 counters. */
export type ShopKind = "weapon" | "armour" | "tool";

/** A character's stock for one gear counter (weapon or armour). */
export interface ShopStock {
  /** Character level the stock was generated at; restocks when it changes. */
  level: number;
  offers: Item[];
}

/** One tool-counter offer. Consumables/grinders restock freely; items are one-shot. */
export type ToolOffer =
  | { type: "consumable"; id: ConsumableId }
  | { type: "grinder" }
  | { type: "item"; item: Tool };

export interface ToolShopStock {
  level: number;
  offers: ToolOffer[];
}

const shopRng = (kind: ShopKind, characterId: string, level: number): Rng =>
  createRng(`shop-${kind}-${characterId}`, level);

// ---- Armor shop (ItemCreator.cc:1007-1188) --------------------------------------

/** get_table_index_for_armor_shop — also the rare-recovery/tech-disk tiers. */
function armorShopTier(level: number): number {
  if (level < 11) return 0;
  if (level < 26) return 1;
  if (level < 43) return 2;
  if (level < 61) return 3;
  return 4;
}

const armorCount = (level: number) => (level < 11 ? 4 : level < 26 ? 6 : 7);
const shieldCount = (level: number) => (level < 11 ? 4 : level < 26 ? 5 : level < 42 ? 6 : 7);
const unitCount = (level: number) => (level < 11 ? 0 : level < 26 ? 3 : level < 43 ? 5 : 6);

/** Ultimate-only armor/shield subtype bump (ItemCreator.cc:1109-1115, 1147-1153). */
function ultimateSubtypeBump(difficulty: DropDifficulty, level: number): number {
  if (difficulty !== "Ultimate" || level <= 99) return 0;
  return level > 150 ? 3 : 2;
}

interface ArmorShopContext {
  level: number;
  difficulty: DropDifficulty;
  sectionId: SectionId;
  rng: Rng;
  mintId: () => string;
}

function drawSubtypes(
  table: readonly WeightedEntry[],
  count: number,
  rng: Rng,
  bump: number,
): number[] {
  const pt = new ProbabilityTable(table);
  pt.shuffle(rng);
  const picked: number[] = [];
  while (picked.length < count) {
    const base = pt.pop();
    if (base === null) break;
    const subtype = base + bump;
    if (picked.includes(subtype)) continue; // duplicate armor rejection
    picked.push(subtype);
  }
  return picked;
}

function generateArmorShopStock(ctx: ArmorShopContext): Item[] {
  const tier = armorShopTier(ctx.level);
  const bump = ultimateSubtypeBump(ctx.difficulty, ctx.level);
  const offers: Item[] = [];
  const dropTable = commonDropTable(ctx.difficulty, ctx.sectionId);

  for (const subtype of drawSubtypes(SHOP_TABLES.armor.armorTable[tier], armorCount(ctx.level), ctx.rng, bump)) {
    const code = `0101${hexByte(subtype)}`;
    if (!frameDef(code)) continue; // bumped past the table's last row
    const frame = { ...(templateFromCode(code) as Omit<Frame, "id">), id: ctx.mintId() } as Frame;
    // Slot roll via the common drop table; DFP/EVP stay base (no variance —
    // generate_common_armor_slots_and_bonuses is drop-only in the source).
    const slots = sampleWeightedIndex(dropTable.ArmorSlotCountProbTable, ctx.rng) ?? 0;
    frame.unitSlots = slots;
    frame.slots = slots;
    offers.push(frame);
  }
  for (const subtype of drawSubtypes(SHOP_TABLES.armor.shieldTable[tier], shieldCount(ctx.level), ctx.rng, bump)) {
    const code = `0102${hexByte(subtype)}`;
    const template = safeTemplate(code);
    if (!template) continue;
    offers.push({ ...(template as Omit<Barrier, "id">), id: ctx.mintId() } as Barrier);
  }
  for (const unitType of drawSubtypes(SHOP_TABLES.armor.unitTable[tier], unitCount(ctx.level), ctx.rng, 0)) {
    const code = `0103${hexByte(unitType)}`;
    const template = safeTemplate(code);
    if (!template) continue;
    offers.push({ ...(template as Omit<Unit, "id">), id: ctx.mintId() } as Unit);
  }
  return offers;
}

function safeTemplate(code: string) {
  try {
    return templateFromCode(code);
  } catch {
    return null;
  }
}

// ---- Tool shop (ItemCreator.cc:1190-1328) ----------------------------------------

/** Common-recovery tiers use their own breakpoints (ItemCreator.cc:1214-1227). */
function commonRecoveryTier(level: number): number {
  if (level < 11) return 0;
  if (level < 26) return 1;
  if (level < 45) return 2;
  if (level < 61) return 3;
  if (level < 100) return 4;
  return 5;
}

const techDiskCount = (level: number) => (level < 11 ? 4 : level < 43 ? 5 : 7);

const CONSUMABLE_BY_CODE = new Map<string, ConsumableId>(CONSUMABLES_LIST.map((c) => [c.code, c.id]));

function toolOfferForCode(code: string, mintId: () => string): ToolOffer | null {
  if (code === MONOGRINDER_CODE) return { type: "grinder" };
  const consumable = CONSUMABLE_BY_CODE.get(code);
  if (consumable) return { type: "consumable", id: consumable };
  const def = toolDef(code);
  if (!def) return null;
  // Non-consumable stock (Scape Doll): a one-shot inert inventory item.
  const item: Tool = {
    kind: "tool",
    id: mintId(),
    defId: code,
    code,
    name: def.name ?? code,
    rarity: "common",
    stars: def.stars,
    sellValue: def.sellValue,
  };
  return { type: "item", item };
}

/** choose_tech_disk_level_for_tool_shop (ItemCreator.cc:1301-1328), 1-based result. */
function rollTechDiskLevel(mode: TechDiskLevelMode, playerLevel: number, rng: Rng): number {
  if (mode.PlayerLevelDivisor !== undefined) {
    const raw = Math.trunc(Math.min(playerLevel, 99) / mode.PlayerLevelDivisor) - 1;
    return Math.min(Math.max(raw, 0), 14) + 1;
  }
  if (mode.MinLevel !== undefined && mode.MaxLevel !== undefined) {
    // Authentic quirk: uniform in [0, max-1], then clamped UP to min — draws
    // below min collapse onto it, over-representing the minimum level.
    const minLevel = Math.max(mode.MinLevel - 1, 0);
    const drawn = rng.int(0, Math.max(mode.MaxLevel - 1, 0));
    return Math.min(Math.max(drawn, minLevel), 14) + 1;
  }
  return 1; // LEVEL_1 mode ({})
}

function generateToolShopStock(level: number, rng: Rng, mintId: () => string): ToolOffer[] {
  const offers: ToolOffer[] = [];
  const seenCodes = new Set<string>();
  const addOffer = (code: string | null) => {
    if (code === null || seenCodes.has(code)) return;
    const offer = toolOfferForCode(code, mintId);
    if (!offer) return;
    seenCodes.add(code);
    offers.push(offer);
  };

  // Fixed common-recovery row: every non-sentinel entry is always in stock.
  for (const entry of SHOP_TABLES.tool.commonRecoveryTable[commonRecoveryTier(level)]) {
    if (entry !== TOOL_SHOP_NOTHING) addOffer(toolCodeForEntry(entry));
  }

  // Two weighted rare-recovery picks at level 11+; a popped "Nothing" reduces
  // the target count once (ItemCreator.cc:1241-1270).
  if (level >= 11) {
    const pt = new ProbabilityTable(SHOP_TABLES.tool.rareRecoveryTable[armorShopTier(level)]);
    pt.shuffle(rng);
    let target = 2;
    let nothingSeen = false;
    let collected = 0;
    while (collected < target) {
      const entry = pt.pop();
      if (entry === null) break;
      if (entry === TOOL_SHOP_NOTHING) {
        if (!nothingSeen) {
          nothingSeen = true;
          target--;
        }
        continue;
      }
      const before = seenCodes.size;
      addOffer(toolCodeForEntry(entry));
      if (seenCodes.size > before) collected++;
    }
  }

  // Concession: grinders are core to the idle meta loop, so one grinder offer
  // is always stocked (authentically Monogrinders only surface as a rare-
  // recovery pick). Skipped when the rare roll already stocked one.
  if (!offers.some((o) => o.type === "grinder")) {
    seenCodes.add(MONOGRINDER_CODE);
    offers.push({ type: "grinder" });
  }

  // Tech disks: weighted picks with duplicate-technique rejection, level per
  // the three table modes (shop-generation spec).
  const diskTier = armorShopTier(level);
  const pt = new ProbabilityTable(SHOP_TABLES.tool.techDiskTable[diskTier]);
  pt.shuffle(rng);
  const target = techDiskCount(level);
  const seenTechs = new Set<number>();
  while (seenTechs.size < target) {
    const entry = pt.pop();
    if (entry === null) break;
    if (seenTechs.has(entry)) continue;
    seenTechs.add(entry);
    const { tech, name } = SHOP_TABLES.tool.techNumMap[entry];
    const techLevel = rollTechDiskLevel(SHOP_TABLES.tool.techDiskLevelTable[diskTier][entry], level, rng);
    const code = `0302${hexByte(tech)}`;
    const def = toolDef(code);
    if (!def) continue;
    const disk: Tool = {
      kind: "tool",
      id: mintId(),
      defId: code,
      code,
      name: `Disk:${name} Lv.${techLevel}`,
      rarity: "common",
      stars: def.stars,
      sellValue: (def.cost * techLevel) >> 3,
      tech,
      techLevel,
    };
    offers.push({ type: "item", item: disk });
  }

  return offers;
}

// ---- Weapon shop (ItemCreator.cc:1330-1545) ---------------------------------------

const weaponCount = (level: number) => (level < 11 ? 10 : level < 43 ? 12 : 16);

/** Per-difficulty weapon tier index (ItemCreator.cc:1340-1369). */
export function weaponShopTier(level: number, difficulty: DropDifficulty): number {
  if (difficulty === "Ultimate") {
    if (level < 11) return 0;
    if (level < 26) return 1;
    if (level < 43) return 2;
    if (level < 61) return 3;
    if (level < 100) return 4;
    if (level < 151) return 5;
    return 6;
  }
  return armorShopTier(level);
}

/** generate_weapon_shop_item_grind tiers (ItemCreator.cc:1407-1431). */
function grindTier(level: number): number {
  if (level < 4) return 0;
  if (level < 11) return 1;
  if (level < 26) return 2;
  if (level < 41) return 3;
  if (level < 56) return 4;
  return 5;
}

/** generate_weapon_shop_item_special tiers (ItemCreator.cc:1433-1472). */
function specialTier(level: number): number {
  if (level < 11) return 0;
  if (level < 18) return 1;
  if (level < 26) return 2;
  if (level < 36) return 3;
  if (level < 46) return 4;
  if (level < 61) return 5;
  if (level < 76) return 6;
  return 7;
}

/** Bonus tiers: bonus1 first cut at <4, bonus2 at <6 (ItemCreator.cc:1474-1545). */
function bonusTier(level: number, firstCut: number): number {
  if (level < firstCut) return 0;
  if (level < 11) return 1;
  if (level < 18) return 2;
  if (level < 26) return 3;
  if (level < 36) return 4;
  if (level < 46) return 5;
  if (level < 61) return 6;
  if (level < 76) return 7;
  return 8;
}

/**
 * choose_weapon_special(det) (ItemCreator.cc:864-886): det selects the star
 * bucket (det+1), a uniform pick over the bucket's hardcoded size chooses the
 * det2-th eligible special in table order. Returns 0 for "none".
 */
function chooseShopWeaponSpecial(det: 0 | 1, rng: Rng): number {
  const maxes = [8, 10, 11, 11];
  const det2 = rng.int(0, maxes[det] - 1);
  let index = 0;
  for (const special of allSpecials()) {
    if (special.index === 0) continue;
    if (special.stars === det + 1) {
      if (index === det2) return special.index;
      index++;
    }
  }
  return 0;
}

/**
 * Weapon bonus magnitude (ItemCreator.cc:1474-1545): uniform index in
 * [0, range.max], clamped UP to range.min (the authentic low-only clamp —
 * draws below min collapse onto it), mapped through bonus_values.
 */
function rollBonusValue(range: Range, rng: Rng): number {
  const index = Math.max(rng.int(0, range[1]), range[0]);
  return SHOP_TABLES.bonusValues[index];
}

const BONUS_KEYS: (keyof WeaponBonuses)[] = ["native", "aBeast", "machine", "dark", "hit"];

function generateWeaponShopStock(
  level: number,
  difficulty: DropDifficulty,
  sectionId: SectionId,
  rng: Rng,
  mintId: () => string,
): Item[] {
  const tables = weaponShopTables(difficulty);
  const sectionIndex = sectionIdIndex(sectionId);
  const tier = weaponShopTier(level, difficulty);
  const typeTable = new ProbabilityTable(tables.typeWeightTables[tier][sectionIndex]);
  typeTable.shuffle(rng);

  const offers: Weapon[] = [];
  const typeCounts = new Map<number, number>();
  const target = weaponCount(level);

  while (offers.length < target) {
    const typeCode = typeTable.pop();
    if (typeCode === null) break;
    const code = weaponCodeForTypeCode(typeCode, sectionIndex);
    const def = weaponDef(code);
    if (!def) continue;

    // ≤2 entries of the same weapon type (data1[1]) — ItemCreator.cc:1056-1073.
    const weaponType = parseInt(code.slice(2, 4), 16);
    if ((typeCounts.get(weaponType) ?? 0) >= 2) continue;

    const weapon = { ...(templateFromCode(code) as Omit<Weapon, "id">), id: mintId() } as Weapon;

    // Grind: default or favored range (favored-type match on data1[1]),
    // clamped to [range.min, def.maxGrind].
    const favored = SHOP_TABLES.favoredWeaponType[sectionIndex];
    const gTier = grindTier(level);
    const range =
      favored !== null && favored === weaponType
        ? tables.favoredGrindRangeTable[gTier]
        : tables.defaultGrindRangeTable[gTier];
    weapon.grind = Math.min(Math.max(rng.int(0, range[1]), range[0]), def.maxGrind);

    // Special: mode 0 none / 1 low tier / 2 high tier.
    const modeTable = new ProbabilityTable(tables.specialModeTable[specialTier(level)]);
    modeTable.shuffle(rng);
    const mode = modeTable.pop() ?? 0;
    if (mode === 1 || mode === 2) {
      const special = chooseShopWeaponSpecial((mode - 1) as 0 | 1, rng);
      if (special > 0) weapon.special = special;
    }

    // Bonus 1: single weighted draw; bonus 2: pop-until-different-type.
    const bonuses: WeaponBonuses = {};
    const b1Table = new ProbabilityTable(tables.bonusTypeTable1[bonusTier(level, 4)]);
    b1Table.shuffle(rng);
    const type1 = b1Table.pop() ?? 0;
    if (type1 > 0) bonuses[BONUS_KEYS[type1 - 1]] = rollBonusValue(tables.bonusRangeTable1[bonusTier(level, 4)], rng);
    const b2Table = new ProbabilityTable(tables.bonusTypeTable2[bonusTier(level, 6)]);
    b2Table.shuffle(rng);
    let type2 = 0;
    for (;;) {
      const popped = b2Table.pop();
      if (popped === null) {
        type2 = 0;
        break;
      }
      if (popped === 0 || popped !== type1) {
        type2 = popped;
        break;
      }
    }
    if (type2 > 0) bonuses[BONUS_KEYS[type2 - 1]] = rollBonusValue(tables.bonusRangeTable2[bonusTier(level, 6)], rng);
    if (Object.keys(bonuses).length > 0) weapon.bonuses = bonuses;

    // Exact-duplicate rejection (same code + rolled attributes).
    const signature = `${code}:${weapon.grind}:${weapon.special ?? 0}:${JSON.stringify(weapon.bonuses ?? {})}`;
    if (offers.some((o) => `${o.code}:${o.grind}:${o.special ?? 0}:${JSON.stringify(o.bonuses ?? {})}` === signature)) {
      continue;
    }

    typeCounts.set(weaponType, (typeCounts.get(weaponType) ?? 0) + 1);
    offers.push(weapon); // tekked: true comes from the template
  }
  return offers;
}

// ---- Stock entry points --------------------------------------------------------

/**
 * Deterministic stock for a gear counter: a pure function of
 * (kind, characterId, level, sectionId). The counters draw independent streams.
 */
export function generateGearStock(
  characterId: string,
  kind: "weapon" | "armour",
  level: number,
  sectionId: SectionId,
): ShopStock {
  const rng = shopRng(kind, characterId, level);
  let counter = 0;
  const mintId = () => `shop-${kind}-${characterId}-${level}-${counter++}`;
  const difficulty = shopDifficulty(level);
  const offers =
    kind === "weapon"
      ? generateWeaponShopStock(level, difficulty, sectionId, rng, mintId)
      : generateArmorShopStock({ level, difficulty, sectionId, rng, mintId });
  return { level, offers };
}

export function generateToolStock(characterId: string, level: number): ToolShopStock {
  const rng = shopRng("tool", characterId, level);
  let counter = 0;
  const mintId = () => `shop-tool-${characterId}-${level}-${counter++}`;
  return { level, offers: generateToolShopStock(level, rng, mintId) };
}

// ---- Purchasing ------------------------------------------------------------------

export type PurchaseResult = { ok: true; spent: number } | { ok: false; reason: string };

/**
 * Buy a gear offer: deducts shared meseta at the authentic price, moves the
 * item to the shared inventory, and removes the offer from the stock.
 */
export function buyGear(economy: EconomyState, stock: ShopStock, offerId: string): PurchaseResult {
  const idx = stock.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) return { ok: false, reason: "no such offer" };
  const item = stock.offers[idx];
  const cost = priceForItem(item);
  if (economy.meseta < cost) return { ok: false, reason: "insufficient meseta" };
  economy.meseta -= cost;
  stock.offers.splice(idx, 1);
  economy.inventory.push(item);
  return { ok: true, spent: cost };
}

/** Buy a one-shot tool-counter item (tech disk, Scape Doll) into inventory. */
export function buyToolItem(economy: EconomyState, stock: ToolShopStock, itemId: string): PurchaseResult {
  const idx = stock.offers.findIndex((o) => o.type === "item" && o.item.id === itemId);
  if (idx < 0) return { ok: false, reason: "no such offer" };
  const offer = stock.offers[idx] as Extract<ToolOffer, { type: "item" }>;
  const cost = priceForItem(offer.item);
  if (economy.meseta < cost) return { ok: false, reason: "insufficient meseta" };
  economy.meseta -= cost;
  stock.offers.splice(idx, 1);
  economy.inventory.push(offer.item);
  return { ok: true, spent: cost };
}

export function buyConsumable(
  economy: EconomyState,
  supply: Supply,
  id: ConsumableId,
  quantity: number,
): PurchaseResult {
  if (quantity <= 0) return { ok: false, reason: "quantity must be positive" };
  const cost = CONSUMABLES[id].price * quantity;
  if (economy.meseta < cost) return { ok: false, reason: "insufficient meseta" };
  economy.meseta -= cost;
  addToSupply(supply, id, quantity);
  return { ok: true, spent: cost };
}

export function buyGrinders(economy: EconomyState, quantity: number): PurchaseResult {
  if (quantity <= 0) return { ok: false, reason: "quantity must be positive" };
  const cost = GRINDER_PRICE * quantity;
  if (economy.meseta < cost) return { ok: false, reason: "insufficient meseta" };
  economy.meseta -= cost;
  economy.grinders += quantity;
  return { ok: true, spent: cost };
}
