import { describe, it, expect } from "vitest";
import { createRng } from "../src/engine/rng";

describe("seeded RNG", () => {
  it("reproduces the same stream for the same (runId, seed)", () => {
    const a = createRng("run-1", 42);
    const b = createRng("run-1", 42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different keys", () => {
    const a = Array.from({ length: 10 }, (_, __) => 0);
    const r1 = createRng("run-1", 42);
    const r2 = createRng("run-2", 42);
    const r3 = createRng("run-1", 43);
    const s1 = a.map(() => r1.next());
    const s2 = a.map(() => r2.next());
    const s3 = a.map(() => r3.next());
    expect(s1).not.toEqual(s2);
    expect(s1).not.toEqual(s3);
  });

  it("stays in range for next/int/float", () => {
    const r = createRng("range", 1);
    for (let i = 0; i < 1000; i++) {
      const n = r.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const k = r.int(3, 7);
      expect(k).toBeGreaterThanOrEqual(3);
      expect(k).toBeLessThanOrEqual(7);
      const f = r.float(-2, 2);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(2);
    }
  });

  it("chance(0) is always false and chance(1) always true", () => {
    const r = createRng("c", 9);
    for (let i = 0; i < 50; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });

  it("int rejects an empty range", () => {
    const r = createRng("e", 1);
    expect(() => r.int(5, 4)).toThrow();
  });
});
