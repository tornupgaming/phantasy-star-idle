/**
 * weapon-avoidance spec: every weapon kind has an avoidance value, the
 * range-based tier ordering holds, barehanded resolves to the fist row, and
 * unknown kinds throw (same convention as the frame-data accessor).
 */

import { describe, expect, it } from "vitest";
import { AVOIDANCE_PCT, weaponAvoidancePct } from "../src/engine/data/avoidance";
import { WEAPON_KIND_NAMES } from "../src/engine/items";

describe("avoidance table", () => {
  it("every one of the 19 kinds resolves to a value in (0, 100)", () => {
    expect(WEAPON_KIND_NAMES.length).toBe(19);
    for (const kind of WEAPON_KIND_NAMES) {
      const pct = AVOIDANCE_PCT[kind];
      expect(pct, kind).toBeGreaterThan(0);
      expect(pct, kind).toBeLessThan(100);
    }
  });

  it("range ordering holds across tiers", () => {
    const a = AVOIDANCE_PCT;
    expect(a.rifle).toBeGreaterThan(a.handgun);
    expect(a.handgun).toBeGreaterThanOrEqual(a.launcher);
    expect(a.launcher).toBeGreaterThan(a.slicer);
    expect(a.slicer).toBeGreaterThan(a.mechgun);
    expect(a.mechgun).toBeGreaterThanOrEqual(a.shot);
    expect(a.shot).toBeGreaterThan(a.partisan);
    expect(a.partisan).toBeGreaterThan(a.saber);
    // force melee sits with point-blank melee
    for (const kind of ["cane", "rod", "wand"] as const) {
      expect(a[kind]).toBe(a.saber);
    }
    // slicer and card share the thrown/mid tier
    expect(a.card).toBe(a.slicer);
  });

  it("numeric kinds resolve via WEAPON_KIND_NAMES", () => {
    WEAPON_KIND_NAMES.forEach((name, index) => {
      expect(weaponAvoidancePct(index)).toBe(AVOIDANCE_PCT[name]);
    });
  });

  it("barehanded (null) returns the fist value", () => {
    expect(weaponAvoidancePct(null)).toBe(AVOIDANCE_PCT.fist);
  });

  it("unknown numeric kind throws", () => {
    expect(() => weaponAvoidancePct(19)).toThrow(/unknown WeaponKind/);
    expect(() => weaponAvoidancePct(-1)).toThrow(/unknown WeaponKind/);
  });
});
