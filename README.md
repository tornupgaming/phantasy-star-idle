# Phantasy Star Idle

A PSO-style idle ARPG. Equip and grind gear, stock consumables, set a loot filter,
then **send** a solo character on a background, self-resolving run through an area's
rooms. Combat uses authentic PSO damage math (hit/crit/spread/truncation, a hard
0-damage wall) driven by a seeded RNG, so a reloaded run reproduces the identical
battle log and loot. All the decisions live in the meta layer; the run runs itself.

## Stack

TypeScript + Vite (browser app, SolidJS menus + imperative canvas islands) +
Vitest. The simulation engine (`src/engine/*`) is runtime-agnostic and pure;
the UI (`src/ui/*`) is a thin presentation layer, and persistence goes
through a small storage port (localStorage in the browser, in-memory in
tests).

## Commands

```bash
corepack enable    # once, if pnpm is not already available
pnpm install       # install the exact dependency graph from pnpm-lock.yaml
pnpm dev           # start the dev server (open the printed URL)
pnpm check         # typecheck, test, and create a production build
pnpm test          # run the Vitest suite (formulas, replay determinism, e2e loop)
```

Node.js 22.12 or newer is required. Use pnpm exclusively; `packageManager`
pins the expected pnpm release for Corepack and CI.

## Architecture

- `engine/rng.ts` — seeded RNG keyed to `(runId, seed)`; the determinism contract.
- `engine/stats.ts`, `character.ts`, `items.ts` — stat model, equipment, grinding.
- `engine/combat.ts` — per-attack pipeline (hit → crit → damage), attack patterns.
- `engine/enemies.ts`, `areas.ts`, `pacing.ts`, `content.ts` — data + authored content.
- `engine/consumables.ts`, `survival.ts` — supply, auto-heal/revive.
- `engine/loot.ts`, `shop.ts` — drop generation, loot filter, meseta, inventory, shop.
- `engine/run.ts` — `simulateRun`: deterministic room-by-room run + battle log.
- `engine/game.ts` — orchestration, persistence, the game clock + offline resume.
- `ui/components/` — SolidJS components in atomic-design layers
  (`atoms/` → `molecules/` → `organisms/` → `templates/` → `pages/`); see
  `CLAUDE.md` for the layer rules.
- `ui/app.tsx`, `ui/context.tsx`, `ui/store.ts` — app shell/regime switch,
  UI signals + actions, engine→store sync. `ui/stage.ts` and `ui/backdrop.ts`
  are imperative canvas islands. `main.ts` boots the game clock and mounts.

Archived design decisions and feature specifications live under
`openspec/changes/archive/`. Domain terminology and agent workflow guidance
live in `CONTEXT.md` and `AGENTS.md`.

No trademarked names or assets are used — only the mechanical model.
