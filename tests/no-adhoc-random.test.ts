import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard for the seeded-replay contract (design D2): engine code must never pull
 * from a non-reproducible source. All randomness flows through `createRng`.
 */
const ENGINE_DIR = join(__dirname, "..", "src", "engine");
const FORBIDDEN = [/Math\.random\s*\(/, /\bDate\.now\s*\(/, /new Date\s*\(\s*\)/];
const ALLOW_FILE = new Set(["rng.ts"]); // rng.ts is the sanctioned boundary

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Strip block and line comments so prose mentioning the forbidden APIs is ignored. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("no ad-hoc randomness in engine", () => {
  it("engine files use only the seeded RNG", () => {
    const offenders: string[] = [];
    for (const file of walk(ENGINE_DIR)) {
      if (!file.endsWith(".ts")) continue;
      const base = file.split("/").pop() as string;
      if (ALLOW_FILE.has(base)) continue;
      const src = stripComments(readFileSync(file, "utf8"));
      for (const pattern of FORBIDDEN) {
        if (pattern.test(src)) offenders.push(`${base}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
