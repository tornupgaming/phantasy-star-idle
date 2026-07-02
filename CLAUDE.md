# Phantasy Star Idle — Claude guidance

A PSO-style idle ARPG. See `README.md` for stack, commands, and architecture.

## Rules

- The simulation engine (`src/engine/*`) is pure and runtime-agnostic; all
  randomness goes through the seeded RNG in `engine/rng.ts` (a test enforces
  no ad-hoc `Math.random`). Replays must stay deterministic: the same
  `(runId, seed)` must reproduce the identical battle log and loot.
- The UI (`src/ui/*`) is a thin vanilla-DOM presentation layer; no game logic
  lives there. Persistence goes through the `StoragePort` in `engine/save.ts`.
- Saves are versioned (`SAVE_VERSION` in `engine/save.ts`). Any change to
  persisted state shape needs a version bump and a migration decision.
- Combat math follows authentic PSO formulas (hit/crit/spread, integer
  truncation, the hard 0-damage wall). Don't "fix" odd-looking math without
  checking it against the reference below.

## Authentic PSO data reference

A clone of **newserv** (open-source PSO private server) lives at
`/home/psmith/projects/newserv/`. It is the canonical source for stats, drop
rates, item data, and the original calculations — port numbers from there
instead of inventing them. See `docs/newserv-reference.md` for a map of which
file holds what (drop tables, class stats, enemy stats, item parameters) and
which `.hh`/`.cc` files implement the logic.
