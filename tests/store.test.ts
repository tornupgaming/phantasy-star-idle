import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRoot } from "solid-js";
import { memoryStorage } from "../src/engine/save";
import { Game } from "../src/engine/game";
import { createGameStore } from "../src/ui/store";

/**
 * Engine → UI bridge guarantees (reactive-ui-architecture spec):
 * the engine stays framework-agnostic, actions become visible after sync,
 * and reconcile keeps unchanged branches referentially stable.
 */

const ENGINE_DIR = join(__dirname, "..", "src", "engine");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("engine stays framework-agnostic", () => {
  it("no solid-js imports anywhere under src/engine", () => {
    const offenders: string[] = [];
    for (const file of walk(ENGINE_DIR)) {
      if (!file.endsWith(".ts")) continue;
      const src = readFileSync(file, "utf8");
      if (/from\s+["']solid-js|require\(\s*["']solid-js/.test(src)) {
        offenders.push(file.split("/").pop() as string);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("createGameStore", () => {
  it("seeds from a snapshot that does not alias engine state", () => {
    createRoot((dispose) => {
      const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
      const gs = createGameStore(game);
      expect(gs.state.roster[0].character.name).toBe(game.state.roster[0].character.name);
      // Mutating the engine without sync must not leak into the store.
      game.state.economy.meseta += 111;
      expect(gs.state.economy.meseta).toBe(game.state.economy.meseta - 111);
      dispose();
    });
  });

  it("run() applies the engine action and syncs the store", () => {
    createRoot((dispose) => {
      const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
      const gs = createGameStore(game);
      const res = gs.run(() => game.setPattern(["heavy", "heavy", "heavy"]));
      expect(res).toBeUndefined(); // setPattern returns void; result passes through
      expect(gs.state.roster[0].pattern).toEqual(["heavy", "heavy", "heavy"]);

      game.state.economy.meseta = 10_000; // cover the authentic grinder price
      const before = 10_000;
      const buy = gs.run(() => game.buyGrinders(1));
      expect(buy.ok).toBe(true);
      expect(gs.state.economy.meseta).toBeLessThan(before);
      expect(gs.state.economy.grinders).toBe(game.state.economy.grinders);
      dispose();
    });
  });

  it("reconcile keeps unchanged branches referentially stable", () => {
    createRoot((dispose) => {
      const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
      const gs = createGameStore(game);
      const rosterBefore = gs.state.roster;
      const entryBefore = gs.state.roster[0];
      const supplyBefore = gs.state.supply;
      game.state.economy.meseta += 500; // unrelated branch changes
      gs.sync();
      expect(gs.state.roster).toBe(rosterBefore);
      expect(gs.state.roster[0]).toBe(entryBefore);
      expect(gs.state.supply).toBe(supplyBefore);
      dispose();
    });
  });
});
