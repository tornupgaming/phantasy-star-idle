import { describe, it, expect } from "vitest";
import type { Weapon, Frame, Unit } from "../src/engine/items";
import {
  emptyEquipment,
  effectiveStats,
  baseStats,
  applyRunXp,
  characterPvar,
  equip,
  unequip,
  grindWeapon,
  unitCapacity,
  previewStats,
  type Character,
} from "../src/engine/character";
import { statsAtLevel, xpForLevel, sectionIdFromName } from "../src/engine/progression";

function newCharacter(classId = "humar", level = 1): Character {
  return {
    id: "test-1",
    name: "Test",
    classId,
    sectionId: sectionIdFromName("Test"),
    level,
    xp: xpForLevel(classId, level),
    equipment: emptyEquipment(),
  };
}

// Derived HUmar level-1 base stats (pinned in classes.test.ts):
// atp 35, dfp 17, ata 30, evp 45, lck 10, mst 29, hp 20.
const HUMAR_L1 = statsAtLevel("humar", 1);

const weapon = (over: Partial<Weapon> = {}): Weapon => ({
  id: "w1",
  defId: "saber",
  name: "Saber",
  kind: "weapon",
  rarity: "common",
  sellValue: 50,
  weaponType: "saber",
  minAtp: 40,
  spread: 20,
  attribute: 0,
  ata: 15,
  grind: 0,
  maxGrind: 5,
  ...over,
});

const frame = (unitSlots: number): Frame => ({
  id: "f1",
  defId: "frame",
  name: "Frame",
  kind: "frame",
  rarity: "common",
  sellValue: 30,
  dfp: 25,
  evp: 10,
  unitSlots,
});

const unit = (id: string, bonus: Partial<import("../src/engine/stats").Stats>): Unit => ({
  id,
  defId: "unit",
  name: "Unit",
  kind: "unit",
  rarity: "common",
  sellValue: 20,
  bonus,
});

describe("equipment & effective stats", () => {
  it("folds gear contributions into effective stats", () => {
    const c = newCharacter();
    equip(c, weapon({ ata: 15 }));
    equip(c, frame(2));
    equip(c, unit("u1", { atp: 30, dfp: 5 }));
    const s = effectiveStats(c);
    expect(s.atp).toBe(HUMAR_L1.atp + 30); // base + unit (weapon ATP is via EQATP, not here)
    expect(s.dfp).toBe(HUMAR_L1.dfp + 25 + 5); // base + frame + unit
    expect(s.ata).toBe(HUMAR_L1.ata + 15); // base + weapon ata
    expect(s.evp).toBe(HUMAR_L1.evp + 10); // base + frame
  });

  it("derives base stats from class + level", () => {
    const c1 = newCharacter("humar", 1);
    expect(baseStats(c1)).toEqual(HUMAR_L1);
    const c10 = newCharacter("humar", 10);
    expect(baseStats(c10)).toEqual(statsAtLevel("humar", 10));
    expect(baseStats(c10).atp).toBeGreaterThan(HUMAR_L1.atp);
  });

  it("pvar is class-derived", () => {
    expect(characterPvar(newCharacter("humar"))).toBe(10);
    expect(characterPvar(newCharacter("ramar"))).toBe(8);
    expect(characterPvar(newCharacter("fomarl"))).toBe(6);
  });

  it("limits units to frame slots", () => {
    const c = newCharacter();
    equip(c, frame(1));
    expect(equip(c, unit("u1", {})).ok).toBe(true);
    const second = equip(c, unit("u2", {}));
    expect(second.ok).toBe(false);
    expect(c.equipment.units).toHaveLength(1);
  });

  it("rejects units when no frame is equipped", () => {
    const c = newCharacter();
    expect(unitCapacity(c.equipment)).toBe(0);
    expect(equip(c, unit("u1", {})).ok).toBe(false);
  });

  it("trims orphaned units when a smaller frame is equipped", () => {
    const c = newCharacter();
    equip(c, frame(2));
    equip(c, unit("u1", {}));
    equip(c, unit("u2", {}));
    equip(c, frame(1)); // now only 1 slot
    expect(c.equipment.units).toHaveLength(1);
  });

  it("unequips a unit by id", () => {
    const c = newCharacter();
    equip(c, frame(2));
    equip(c, unit("u1", {}));
    equip(c, unit("u2", {}));
    const removed = unequip(c, "unit", "u1");
    expect(removed?.id).toBe("u1");
    expect(c.equipment.units.map((u) => u.id)).toEqual(["u2"]);
  });
});

describe("grinding", () => {
  it("raises grind by 1 up to max", () => {
    const w = weapon({ grind: 0, maxGrind: 2 });
    expect(grindWeapon(w).ok).toBe(true);
    expect(w.grind).toBe(1);
    expect(grindWeapon(w).ok).toBe(true);
    expect(w.grind).toBe(2);
  });

  it("refuses past max and does not change grind", () => {
    const w = weapon({ grind: 2, maxGrind: 2 });
    expect(grindWeapon(w).ok).toBe(false);
    expect(w.grind).toBe(2);
  });
});

describe("XP application (applyRunXp)", () => {
  it("levels up when crossing thresholds and reports levels gained", () => {
    const c = newCharacter("humar", 1);
    const { levelsGained } = applyRunXp(c, 200); // L3 threshold exactly
    expect(levelsGained).toBe(2);
    expect(c.level).toBe(3);
    expect(c.xp).toBe(200);
    expect(baseStats(c)).toEqual(statsAtLevel("humar", 3));
  });

  it("accumulates XP without leveling below the next threshold", () => {
    const c = newCharacter("humar", 1);
    applyRunXp(c, 49);
    expect(c.level).toBe(1);
    applyRunXp(c, 1); // total 50 → level 2
    expect(c.level).toBe(2);
  });

  it("ignores negative XP and never levels down", () => {
    const c = newCharacter("humar", 5);
    const before = c.xp;
    applyRunXp(c, -100);
    expect(c.xp).toBe(before);
    expect(c.level).toBe(5);
  });
});

describe("stat preview (previewStats, pioneer2-hub-redesign)", () => {
  const equipAll = (c: Character) => {
    equip(c, weapon({ ata: 15 }));
    equip(c, frame(2));
    equip(c, unit("u1", { atp: 30, dfp: 5 }));
  };

  it("preview of a weapon swap matches the committed equip, without mutating", () => {
    const c = newCharacter();
    equipAll(c);
    const before = effectiveStats(c);
    const candidate = weapon({ id: "w2", ata: 40 });
    const preview = previewStats(c, "weapon", candidate);
    expect(c.equipment.weapon?.id).toBe("w1"); // untouched
    expect(effectiveStats(c)).toEqual(before);
    equip(c, candidate);
    expect(effectiveStats(c)).toEqual(preview);
  });

  it("preview of emptying a slot matches the committed unequip", () => {
    const c = newCharacter();
    equipAll(c);
    const weaponPreview = previewStats(c, "weapon", null);
    unequip(c, "weapon");
    expect(effectiveStats(c)).toEqual(weaponPreview);
  });

  it("preview of emptying the frame slot drops the orphaned units too", () => {
    const c = newCharacter();
    equipAll(c); // frame(2) + one unit
    const preview = previewStats(c, "frame", null);
    const bare = newCharacter();
    equip(bare, weapon({ ata: 15 })); // same weapon, no frame, no units
    expect(preview).toEqual(effectiveStats(bare));
  });

  it("frame swap preview trims orphaned units like equip does", () => {
    const c = newCharacter();
    equip(c, frame(2));
    equip(c, unit("u1", { atp: 10 }));
    equip(c, unit("u2", { dfp: 10 }));
    const smaller: Frame = { ...frame(1), id: "f2" };
    const preview = previewStats(c, "frame", smaller);
    expect(c.equipment.units).toHaveLength(2); // untouched
    equip(c, smaller);
    expect(effectiveStats(c)).toEqual(preview);
  });

  it("unit add previews only within capacity; removal previews by id", () => {
    const c = newCharacter();
    equip(c, frame(1));
    const u1 = unit("u1", { atp: 25 });
    const addPreview = previewStats(c, "unit", u1);
    equip(c, u1);
    expect(effectiveStats(c)).toEqual(addPreview);
    // At capacity: preview of another unit is a no-op, not an overflow.
    const overflow = previewStats(c, "unit", unit("u2", { atp: 99 }));
    expect(overflow).toEqual(effectiveStats(c));
    // Removal preview matches the committed unequip.
    const removePreview = previewStats(c, "unit", null, "u1");
    unequip(c, "unit", "u1");
    expect(effectiveStats(c)).toEqual(removePreview);
  });
});

describe("equip requirements (item-parameter-data)", () => {
  // HUmar L1 base: atp 35, ata 30, mst 29 (pinned above).

  it("blocks equip when base ATP is below the requirement", () => {
    const c = newCharacter();
    const heavy = weapon({ requirements: { atp: HUMAR_L1.atp + 1 } });
    const result = equip(c, heavy);
    expect(result).toEqual({ ok: false, reason: `requires ${HUMAR_L1.atp + 1} ATP` });
    expect(c.equipment.weapon).toBeNull();
  });

  it("equips once the requirement is met (leveling raises base stats)", () => {
    const gated = weapon({ requirements: { atp: 100 } });
    const low = newCharacter("humar", 1);
    expect(equip(low, gated).ok).toBe(false);
    const high = newCharacter("humar", 50);
    expect(statsAtLevel("humar", 50).atp).toBeGreaterThanOrEqual(100);
    expect(equip(high, gated).ok).toBe(true);
    expect(high.equipment.weapon).toBe(gated);
  });

  it("checks base stats only — equipment bonuses don't satisfy requirements", () => {
    const c = newCharacter();
    equip(c, frame(2));
    equip(c, unit("u1", { atp: 500 })); // effective ATP is now huge
    const gated = weapon({ requirements: { atp: HUMAR_L1.atp + 1 } });
    expect(equip(c, gated).ok).toBe(false);
  });

  it("blocks classes whose attribute bits aren't all set in usableBy", () => {
    // Bits: 01 hunter, 02 ranger, 04 force, 08 human, 10 android, 20 newman,
    // 40 male, 80 female. hunter|human|male = 0x49 — equippable by HUmar only.
    const humarOnly = weapon({ requirements: { usableBy: 0x49 } });
    const humar = newCharacter("humar");
    const hunewearl = newCharacter("hunewearl"); // hunter|newman|female
    const ramar = newCharacter("ramar"); // ranger|human|male
    expect(equip(humar, humarOnly).ok).toBe(true);
    expect(equip(hunewearl, humarOnly)).toEqual({
      ok: false,
      reason: "cannot be equipped by this class",
    });
    expect(equip(ramar, humarOnly).ok).toBe(false);
  });

  it("gates frames by required level", () => {
    const gated: Frame = { ...frame(2), requirements: { level: 10 } };
    const low = newCharacter("humar", 5);
    expect(equip(low, gated).ok).toBe(false);
    const high = newCharacter("humar", 10);
    expect(equip(high, gated).ok).toBe(true);
  });

  it("requirement-free gear equips exactly as before", () => {
    const c = newCharacter();
    expect(equip(c, weapon()).ok).toBe(true);
    expect(equip(c, frame(2)).ok).toBe(true);
    expect(equip(c, unit("u1", { atp: 10 })).ok).toBe(true);
  });
});
