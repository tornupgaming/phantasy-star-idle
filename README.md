# Phantasy Star Idle

A PSO-style idle ARPG. Equip and grind gear, stock consumables, set a loot filter,
then **send** a solo character on a background, self-resolving run through an area's
rooms. Combat uses authentic PSO damage math (hit/crit/spread/truncation, a hard
0-damage wall) driven by a seeded RNG, so a reloaded run reproduces the identical
battle log and loot. All the decisions live in the meta layer; the run runs itself.

## Stack

TypeScript + Vite (browser app, vanilla DOM) + Vitest. The simulation engine
(`src/engine/*`) is runtime-agnostic and pure; the UI (`src/ui/*`) is a thin
presentation layer, and persistence goes through a small storage port
(localStorage in the browser, in-memory in tests).

## Commands

```bash
npm install        # first-time setup (approve esbuild's install script if prompted)
npm run dev        # start the dev server (open the printed URL)
npm run build      # typecheck + production build to dist/
npm test           # run the Vitest suite (formulas, replay determinism, e2e loop)
npm run typecheck  # tsc --noEmit
```

## Architecture

- `engine/rng.ts` — seeded RNG keyed to `(runId, seed)`; the determinism contract.
- `engine/stats.ts`, `character.ts`, `items.ts` — stat model, equipment, grinding.
- `engine/combat.ts` — per-attack pipeline (hit → crit → damage), attack patterns.
- `engine/enemies.ts`, `areas.ts`, `pacing.ts`, `content.ts` — data + authored content.
- `engine/consumables.ts`, `survival.ts` — supply, auto-heal/revive.
- `engine/loot.ts`, `shop.ts` — drop generation, loot filter, meseta, inventory, shop.
- `engine/run.ts` — `simulateRun`: deterministic room-by-room run + battle log.
- `engine/game.ts` — orchestration, persistence, the game clock + offline resume.
- `ui/views.ts`, `main.ts` — prep view, run view, room map, post-run report.

Design decisions and formulas are documented in
`openspec/changes/establish-core-gameplay-loop/` (proposal, design, specs).

No trademarked names or assets are used — only the mechanical model.
