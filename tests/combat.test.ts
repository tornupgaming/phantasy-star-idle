import { describe, it, expect } from "vitest";
import { createRng } from "../src/engine/rng";
import {
  computeAccuracy,
  computeDamage,
  rollHit,
  rollCrit,
  resolveAttack,
  AttackPattern,
  type Combatant,
} from "../src/engine/combat";

// Deterministic combatants: spread=0 and pvarMax=0 remove the Wvar/Pvar noise so
// damage is a fixed worked example independent of the RNG draws.
const attacker = (over: Partial<Combatant> = {}): Combatant => ({
  name: "A",
  atp: 200,
  dfp: 60,
  ata: 100,
  evp: 50,
  lck: 0,
  eqAtp: 100,
  spread: 0,
  pvarMax: 0,
  critDivisor: 5,
  ...over,
});

const defender = (over: Partial<Combatant> = {}): Combatant => ({
  name: "D",
  atp: 0,
  dfp: 50,
  ata: 0,
  evp: 50,
  lck: 0,
  eqAtp: 0,
  spread: 0,
  pvarMax: 0,
  critDivisor: 2,
  ...over,
});

describe("damage formula", () => {
  const rng = createRng("t", 1);

  it("worked normal hit: ⌊(300−50)/5 × 0.9⌋ = 45", () => {
    // ATPeff = 200 + 100 = 300, DFPeff = 50
    expect(computeDamage(attacker(), defender(), "normal", false, rng)).toBe(45);
  });

  it("truncates, never rounds up (DFP 48 → 45.36 → 45)", () => {
    // (300 − 48)/5 × 0.9 = 45.36
    expect(computeDamage(attacker(), defender({ dfp: 48 }), "normal", false, rng)).toBe(45);
  });

  it("critical multiplies before the floor (45.0 × 1.5 = 67.5 → 67)", () => {
    expect(computeDamage(attacker(), defender(), "normal", true, rng)).toBe(67);
  });

  it("heavy attack applies its damage modifier (45 × 1.89 = 85.05 → 85)", () => {
    expect(computeDamage(attacker(), defender(), "heavy", false, rng)).toBe(85);
  });

  it("hard 0-damage wall when ATPeff ≤ DFPeff (no min-1)", () => {
    const weak = attacker({ atp: 100, eqAtp: 0 }); // ATPeff = 100
    expect(computeDamage(weak, defender({ dfp: 100 }), "normal", false, rng)).toBe(0); // equal
    expect(computeDamage(weak, defender({ dfp: 150 }), "normal", false, rng)).toBe(0); // under
  });

  it("spread + pvar add per-attack variance from the seeded RNG", () => {
    const a = attacker({ spread: 50, pvarMax: 10 });
    const r = createRng("var", 7);
    const samples = new Set<number>();
    for (let i = 0; i < 50; i++) samples.add(computeDamage(a, defender(), "normal", false, r));
    expect(samples.size).toBeGreaterThan(1); // varies
  });
});

describe("hit resolution", () => {
  it("computes accuracy = ATAeff − EVPeff×0.2", () => {
    // ata=100, normal(1.0), step0(1.0) → 100; evp 50 → 100 − 10 = 90
    expect(computeAccuracy(attacker(), defender(), "normal", 0)).toBeCloseTo(90);
  });

  it("heavy 3rd-combo-step finisher becomes a guaranteed hit", () => {
    // 100 × 0.7 × 1.69 = 118.3; − 10 = 108.3 ≥ 100
    const acc = computeAccuracy(attacker(), defender(), "heavy", 2);
    expect(acc).toBeGreaterThanOrEqual(100);
    expect(rollHit(acc, createRng("h", 1))).toBe(true);
  });

  it("≥100 always hits, negative always misses", () => {
    const r = createRng("b", 1);
    expect(rollHit(100, r)).toBe(true);
    expect(rollHit(-1, r)).toBe(false);
    expect(rollHit(0, r)).toBe(false); // 0% chance
  });
});

describe("critical resolution", () => {
  it("LCK 0 never crits", () => {
    const r = createRng("c", 1);
    for (let i = 0; i < 100; i++) expect(rollCrit(attacker({ lck: 0 }), r)).toBe(false);
  });

  it("character crit rate ≈ LCK/5% and enemy ≈ LCK/2%", () => {
    const trials = 20000;
    const charR = createRng("char-crit", 3);
    let charHits = 0;
    for (let i = 0; i < trials; i++) if (rollCrit(attacker({ lck: 50 }), charR)) charHits++;
    expect(charHits / trials).toBeCloseTo(0.1, 1); // 50/5 = 10%

    const enemyR = createRng("enemy-crit", 3);
    let enemyHits = 0;
    for (let i = 0; i < trials; i++)
      if (rollCrit(defender({ lck: 50, critDivisor: 2 }), enemyR)) enemyHits++;
    expect(enemyHits / trials).toBeCloseTo(0.25, 1); // 50/2 = 25%
  });
});

describe("resolveAttack pipeline", () => {
  it("a miss deals 0 damage", () => {
    // Defender evp huge → accuracy negative → always miss
    const out = resolveAttack(attacker(), defender({ evp: 100000 }), "normal", 0, createRng("m", 1));
    expect(out.hit).toBe(false);
    expect(out.damage).toBe(0);
  });
});

describe("attack pattern", () => {
  it("cycles attack types and resets combo step after the third attack", () => {
    const p = new AttackPattern(["normal", "normal", "heavy"]);
    expect([0, 1, 2, 3, 4, 5].map((i) => p.typeAt(i))).toEqual([
      "normal",
      "normal",
      "heavy",
      "normal",
      "normal",
      "heavy",
    ]);
    expect([0, 1, 2, 3, 4, 5].map((i) => p.comboStepAt(i))).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it("pattern and combo cycles are independent for a 2-length pattern", () => {
    const p = new AttackPattern(["normal", "heavy"]);
    expect([0, 1, 2, 3].map((i) => p.typeAt(i))).toEqual(["normal", "heavy", "normal", "heavy"]);
    expect([0, 1, 2, 3].map((i) => p.comboStepAt(i))).toEqual([0, 1, 2, 0]);
  });
});
