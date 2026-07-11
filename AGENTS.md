# Agent guide

Start with `README.md` for setup and architecture, `CLAUDE.md` for coding
constraints, and `CONTEXT.md` for domain language. This file is the concise,
tool-neutral entry point for coding agents.

## Working agreement

- Use Node.js 22.13+ and pnpm. Do not create another package-manager lockfile.
- Preserve simulation determinism. Route game randomness through
  `src/engine/rng.ts`; never use `Math.random` in simulation code.
- Keep `src/engine/` pure and runtime-agnostic. UI code belongs in `src/ui/`,
  and persistence must go through the storage port.
- Treat save-shape changes as migrations: review `SAVE_VERSION` and add tests.
- Follow the Solid component boundaries and required CSS hook classes in
  `CLAUDE.md`; imperative canvas islands are intentionally non-reactive.
- Check authentic game data and formulas against `docs/newserv-reference.md`.

## Change loop

1. Locate the nearest tests and read the relevant archived OpenSpec material.
2. Add or update focused tests with behavior changes.
3. Run the focused test while editing, then `pnpm check` before handoff.
4. Update `README.md`, `CONTEXT.md`, or an ADR when a change alters developer
   workflow, domain language, or an architectural decision.

Generated datasets under `src/engine/data/` are verified against extraction
scripts. Their regeneration tests require the local newserv reference checkout;
see `docs/newserv-reference.md` before changing those files.
