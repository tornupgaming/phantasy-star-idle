/**
 * Engine → UI state bridge (convert-menu-ui-to-solidjs D2). The engine stays
 * framework-agnostic and mutation-based; the UI reads a Solid store that is
 * re-synchronized from a structural snapshot after every engine mutation.
 * `reconcile` diffs the snapshot into the store, so DOM subscribed to
 * unchanged branches doesn't update — this is what makes menu interactions
 * fine-grained. The snapshot (structuredClone) guarantees the store never
 * aliases live engine-owned objects; engine state is JSON-persisted, so the
 * clone is lossless by construction.
 */

import { createStore, reconcile, type Store } from "solid-js/store";
import type { Game, GameState } from "../engine/game";

export interface GameStore {
  /** Read-only reactive view of the engine state. Never write to it. */
  state: Store<GameState>;
  /** Re-sync the store from the engine after a mutation (action or poll). */
  sync(): void;
  /** Run an engine mutation and sync: `const res = gs.run(() => game.buy(...))`. */
  run<T>(action: () => T): T;
}

export function createGameStore(game: Game): GameStore {
  const [state, setState] = createStore<GameState>(structuredClone(game.state));
  const sync = () => setState(reconcile(structuredClone(game.state), { key: "id" }));
  return {
    state,
    sync,
    run(action) {
      const result = action();
      sync();
      return result;
    },
  };
}
