import { describe, expect, it } from "vitest";
import type { Weapon } from "../src/engine/items";
import { itemDisplayName, itemNameClass, weaponHasAttributeBonuses } from "../src/ui/ui-shared";

function weapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: "w1",
    defId: "000100",
    name: "Handgun",
    kind: "weapon",
    weaponType: "handgun",
    rarity: "common",
    sellValue: 100,
    minAtp: 10,
    spread: 5,
    attribute: 0,
    ata: 10,
    grind: 0,
    maxGrind: 5,
    ...overrides,
  };
}

describe("UI item display names", () => {
  it("adds weapon grind only when present", () => {
    expect(itemDisplayName(weapon({ grind: 0 }))).toBe("Handgun");
    expect(itemDisplayName(weapon({ grind: 2 }))).toBe("Handgun +2");
  });

  it("marks weapons with nonzero area/hit attributes green", () => {
    expect(weaponHasAttributeBonuses(weapon({ bonuses: { native: 0, aBeast: 0 } }))).toBe(false);
    const attributed = weapon({ bonuses: { aBeast: 15 } });
    expect(weaponHasAttributeBonuses(attributed)).toBe(true);
    expect(itemNameClass(attributed)).toBe("weapon-attributes");
  });
});
