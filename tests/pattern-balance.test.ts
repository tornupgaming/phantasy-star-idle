/**
 * combat-resolution spec, "Attack pattern balance under frame costs": with
 * Heavy attacks billing their authentic longer frame durations, no attack
 * pattern strictly dominates — expected sustained DPS flips between Normal-
 * and Heavy-leaning patterns across representative accuracy matchups, because
 * Heavy's ×0.7 accuracy is applied to ATA before the subtractive EVP term.
 */

import { describe, expect, it } from "vitest";
import { ATTACK_TYPE_MOD, COMBO_STEP_ACC, type AttackType } from "../src/engine/combat";
import { attackStepMs } from "../src/engine/data/frame-data";
import { COMBO_RECOVERY_MS } from "../src/engine/pacing";

const SABER = 1;

/**
 * Expected sustained DPS of a three-step pattern against a reference target,
 * in expected damage-multiplier units per second (weapon damage cancels when
 * comparing patterns). Mirrors the combat pipeline: accuracy =
 * ATA×typeAcc×comboAcc − EVP×0.2, clamped to [0,100]; each step bills its
 * frame-data duration (Full + repositioning pause on the third).
 */
function expectedDps(pattern: AttackType[], ata: number, evp: number): number {
  let damage = 0;
  let timeMs = COMBO_RECOVERY_MS;
  for (let step = 0; step < pattern.length; step += 1) {
    const type = pattern[step];
    const acc = ata * ATTACK_TYPE_MOD[type].acc * COMBO_STEP_ACC[step] - evp * 0.2;
    const hitRate = Math.min(Math.max(acc, 0), 100) / 100;
    damage += hitRate * ATTACK_TYPE_MOD[type].dmg;
    timeMs += attackStepMs("male", SABER, type, step, step === pattern.length - 1, 0);
  }
  return damage / (timeMs / 1000);
}

const PATTERNS: Record<string, AttackType[]> = {
  NNN: ["normal", "normal", "normal"],
  NNH: ["normal", "normal", "heavy"],
  NHH: ["normal", "heavy", "heavy"],
  HHH: ["heavy", "heavy", "heavy"],
};

function best(ata: number, evp: number): string {
  let bestName = "";
  let bestDps = -1;
  for (const [name, pattern] of Object.entries(PATTERNS)) {
    const dps = expectedDps(pattern, ata, evp);
    if (dps > bestDps) {
      bestDps = dps;
      bestName = name;
    }
  }
  return bestName;
}

describe("attack pattern balance under frame costs", () => {
  it("Heavy-leaning patterns win when accuracy is comfortable", () => {
    // High ATA vs sluggish target: everything caps, Heavy's 1.89× damage
    // out-earns its longer frames.
    expect(best(150, 0)).toBe("HHH");
  });

  it("Normal-leaning patterns win against evasive targets", () => {
    // Low ATA vs high EVP: Heavy's ×0.7 accuracy lands under the EVP floor
    // while Normal still connects.
    expect(best(50, 200)).toBe("NNN");
  });

  it("no single pattern is optimal at every matchup", () => {
    const winners = new Set<string>();
    for (const ata of [40, 80, 120, 160]) {
      for (const evp of [0, 50, 100, 200, 300]) {
        winners.add(best(ata, evp));
      }
    }
    expect(winners.size).toBeGreaterThan(1);
  });

  it("the shipped default (NNH) is competitive in a mid matchup", () => {
    // NNH exploits the combo-accuracy ramp (1.0/1.3/1.69): heavy goes last
    // where its accuracy penalty hurts least. In a mid matchup it should beat
    // at least the all-in patterns' weaker side.
    const ata = 100;
    const evp = 150;
    const nnh = expectedDps(PATTERNS.NNH, ata, evp);
    expect(nnh).toBeGreaterThanOrEqual(Math.min(expectedDps(PATTERNS.NNN, ata, evp), expectedDps(PATTERNS.HHH, ata, evp)));
  });

  it("Heavy pays a real time cost per burst (frame data, not free damage)", () => {
    let nTime = 0;
    let hTime = 0;
    for (let step = 0; step < 3; step += 1) {
      nTime += attackStepMs("male", SABER, "normal", step, step === 2, 0);
      hTime += attackStepMs("male", SABER, "heavy", step, step === 2, 0);
    }
    expect(hTime).toBeGreaterThan(nTime);
  });
});
