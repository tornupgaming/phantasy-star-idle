/**
 * Seeded RNG service — the single foundational determinism contract (design D2).
 *
 * A run's randomness MUST come exclusively from a stream created here, keyed to
 * `(runId, seed)`. Re-creating a stream with the same key and consuming draws in
 * the same order reproduces the identical sequence, which is what lets a saved run
 * be re-simulated into an identical battle log + loot.
 *
 * Rule for sim code: NEVER call `Math.random()` (or `Date.now()`, etc.) in the
 * engine. Take an `Rng` and pull from it. See `tests/rng.test.ts` and the
 * no-Math.random lint guard in `tests/no-adhoc-random.test.ts`.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [minInclusive, maxInclusive]. */
  int(minInclusive: number, maxInclusive: number): number;
  /** True with the given probability (0..1). */
  chance(probability: number): boolean;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Pick a uniformly random element. */
  pick<T>(items: readonly T[]): T;
}

/** xmur3 string hash → 32-bit seed generator. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 PRNG — fast, small state, good enough for gameplay determinism. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a deterministic RNG keyed to `(runId, seed)`. The same key always yields
 * the same stream; consume draws in a fixed order to guarantee replayability.
 */
export function createRng(runId: string, seed: number): Rng {
  const seeder = xmur3(`${runId}:${seed}`);
  const draw = mulberry32(seeder());
  return {
    next: () => draw(),
    int(minInclusive: number, maxInclusive: number): number {
      if (maxInclusive < minInclusive) {
        throw new Error(`int(${minInclusive}, ${maxInclusive}): empty range`);
      }
      const span = maxInclusive - minInclusive + 1;
      return minInclusive + Math.floor(draw() * span);
    },
    chance(probability: number): boolean {
      if (probability <= 0) return false;
      if (probability >= 1) return true;
      return draw() < probability;
    },
    float(min: number, max: number): number {
      return min + draw() * (max - min);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("pick() from empty array");
      return items[Math.floor(draw() * items.length)];
    },
  };
}
