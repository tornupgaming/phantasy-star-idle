/**
 * attack-frame-data spec: the typed accessor converts frames→ms once
 * (round(f×1000/30)), reproduces both anchors exactly, interpolates
 * monotonically for intermediate boosts, falls back to the male rig for sparse
 * rig/kind combinations, maps Special to Heavy timing, and is total over
 * rig × kind × tier × step.
 */

import { describe, expect, it } from "vitest";
import { attackStepMs, type Rig } from "../src/engine/data/frame-data";
import { WEAPON_KIND_NAMES } from "../src/engine/items";
import type { AttackType } from "../src/engine/combat";

const ms = (frames: number) => Math.round((frames * 1000) / 30);

const SABER = 1;
const SWORD = 2;
const HANDGUN = 6;
const RIGS: Rig[] = ["male", "female", "hucaseal", "ramarl", "fomar", "fomarl"];

describe("attackStepMs", () => {
  it("reproduces the 0% anchor exactly at boost 0", () => {
    // Male saber Normal @0%: full1 32, combo1 16, full2 28, combo2 14, full3 40.
    expect(attackStepMs("male", SABER, "normal", 0, true, 0)).toBe(ms(32));
    expect(attackStepMs("male", SABER, "normal", 0, false, 0)).toBe(ms(16));
    expect(attackStepMs("male", SABER, "normal", 1, true, 0)).toBe(ms(28));
    expect(attackStepMs("male", SABER, "normal", 1, false, 0)).toBe(ms(14));
    expect(attackStepMs("male", SABER, "normal", 2, true, 0)).toBe(ms(40));
  });

  it("reproduces the +40% anchor exactly at boost 40", () => {
    // Male saber Normal @+40%: full1 29, combo1 13, full2 24, combo2 10, full3 31.
    expect(attackStepMs("male", SABER, "normal", 0, true, 40)).toBe(ms(29));
    expect(attackStepMs("male", SABER, "normal", 0, false, 40)).toBe(ms(13));
    expect(attackStepMs("male", SABER, "normal", 2, true, 40)).toBe(ms(31));
    // Male handgun Normal @+40% combo1 = 14 frames.
    expect(attackStepMs("male", HANDGUN, "normal", 0, false, 40)).toBe(ms(14));
  });

  it("interpolates monotonically for the intermediate unit boosts", () => {
    for (const kind of [SABER, SWORD, HANDGUN]) {
      const at = (p: number) => attackStepMs("male", kind, "normal", 0, false, p);
      const durations = [0, 5, 10, 20, 40].map(at);
      for (let i = 1; i < durations.length; i += 1) {
        expect(durations[i]).toBeLessThanOrEqual(durations[i - 1]);
      }
      expect(at(5)).toBeLessThanOrEqual(at(0));
      expect(at(20)).toBeGreaterThanOrEqual(at(40));
    }
  });

  it("clamps out-of-range boosts to the anchors", () => {
    expect(attackStepMs("male", SABER, "normal", 0, false, -10)).toBe(
      attackStepMs("male", SABER, "normal", 0, false, 0),
    );
    expect(attackStepMs("male", SABER, "normal", 0, false, 99)).toBe(
      attackStepMs("male", SABER, "normal", 0, false, 40),
    );
  });

  it("falls back to the male rig for kinds a rig does not override", () => {
    // Female sword is not measured separately — same speed as male (wiki rule).
    expect(attackStepMs("female", SWORD, "normal", 0, false, 0)).toBe(
      attackStepMs("male", SWORD, "normal", 0, false, 0),
    );
    // Female saber IS overridden: step-2 full differs from male (26 vs 24 @40%).
    expect(attackStepMs("female", SABER, "normal", 1, true, 40)).toBe(ms(26));
    expect(attackStepMs("male", SABER, "normal", 1, true, 40)).toBe(ms(24));
  });

  it("uses Heavy timing for Special attacks", () => {
    for (const step of [0, 1, 2]) {
      expect(attackStepMs("male", SABER, "special", step, step === 2, 0)).toBe(
        attackStepMs("male", SABER, "heavy", step, step === 2, 0),
      );
    }
  });

  it("Heavy is never faster than Normal except the final hit's recovery", () => {
    // Authentic quirk: on some kinds (sword, dagger, double/twin sabers) the
    // Heavy third hit's FULL recovery settles a few frames quicker than
    // Normal's, so step 2 is excluded — everywhere else Heavy costs more.
    for (const rig of RIGS) {
      for (let kind = 0; kind < WEAPON_KIND_NAMES.length; kind += 1) {
        for (const [step, isFinal] of [[0, false], [0, true], [1, false], [1, true]] as const) {
          const n = attackStepMs(rig, kind, "normal", step, isFinal, 0);
          const h = attackStepMs(rig, kind, "heavy", step, isFinal, 0);
          expect(h, `${rig}/kind${kind}/step${step}${isFinal ? "F" : "C"}`).toBeGreaterThanOrEqual(n);
        }
      }
    }
  });

  it("is total: every rig × kind × tier × step × boost resolves to a positive integer", () => {
    const tiers: AttackType[] = ["normal", "heavy", "special"];
    for (const rig of RIGS) {
      for (let kind = 0; kind < WEAPON_KIND_NAMES.length; kind += 1) {
        for (const tier of tiers) {
          for (const step of [0, 1, 2]) {
            for (const isFinal of [false, true]) {
              for (const boost of [0, 5, 10, 20, 40]) {
                const v = attackStepMs(rig, kind, tier, step, isFinal, boost);
                expect(Number.isInteger(v)).toBe(true);
                expect(v).toBeGreaterThan(0);
              }
            }
          }
        }
      }
    }
  });

  it("rejects unknown weapon kinds", () => {
    expect(() => attackStepMs("male", 19, "normal", 0, false, 0)).toThrow(/WeaponKind/);
  });
});
