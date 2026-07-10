# Code-splitting todo

Goal: reduce the initial JavaScript payload without changing deterministic
simulation, save compatibility, or the imperative battle-stage lifecycle.

- [x] Record a baseline with `pnpm build`: entry chunk bytes, gzip bytes, and
  initial network requests. The current warning is approximately 1.24 MB raw /
  180 kB gzip.
- [x] Add a temporary bundle-analysis report and identify the largest modules.
  Check generated datasets first (`map-spawns.json`, common/rare drop tables,
  item/shop tables); do not assume enemy PNGs are part of the JavaScript chunk.
- [x] Write a focused test that mounts each UI regime after any asynchronous
  boundary: select, create, hub, and active run.
- [x] Lazy-load the run-only UI boundary (`RunPage`, `BattleStage`, minimap,
  room geometry, and enemy-art lookup) with Solid's supported lazy mechanism.
  Preserve the rule that `BattleStage` mounts once and owns its DOM/rAF loop.
- [x] Evaluate replacing the eager enemy-art glob in `src/ui/enemy-art.ts` with
  lazy URL resolution; analysis showed no startup-request improvement. Keep the existing
  difficulty-name → base-id → placeholder fallback behavior.
- [x] If generated engine datasets still dominate the initial graph, design an
  explicit async data-loading boundary before changing them. `Game.loadOrNew`
  and run replay are currently synchronous; do not introduce dynamic imports
  inside seeded simulation or allow load timing to affect results.
- [x] Avoid `manualChunks` used only to hide Vite's warning: accept a split only
  when the browser defers downloading or evaluating code not needed at startup.
- [x] Rebuild and compare against the baseline. Document the before/after raw,
  gzip, and initial-request figures in the commit or PR description.
- [x] Run `pnpm check` and confirm all 366+ tests pass, especially replay,
  migration, stage, UI smoke, and no-ad-hoc-random tests.

Done when the initial route has a materially smaller evaluated payload, no
large-chunk warning remains (or a measured exception is documented), and all
existing behavior and determinism contracts are preserved.

## Measurements and decisions

Measurements use Vite's production-build output. The initial page requests the
document, stylesheet, and entry module; the two stylesheet fonts are fetched
when text using them renders. Enemy PNGs are emitted as independent assets and
are requested only when a battle-stage image uses their URL.

| Build | Initial entry (raw) | Initial entry (gzip) | Initial requests | Deferred run chunk |
| --- | ---: | ---: | --- | ---: |
| Before | 1,238.37 kB | 180.00 kB | 3 core + up to 2 fonts | none |
| After | 1,189.83 kB | 167.46 kB | 3 core + up to 2 fonts | 55.34 kB raw / 16.01 kB gzip |

The three core requests are the document, stylesheet, and entry module. The
regular and bold fonts are requested as their styled text renders. After the
split, entering a run adds one JavaScript request; enemy PNG requests remain
limited to sprites actually shown by the stage.

The lazy `RunPage` boundary defers `BattleStage`, scene and minimap rendering,
the 135.76 kB room-coordinate dataset, the enemy-art URL registry, and the
damage-font metadata until a run is active. `RunPage` remains the single owner
of the stage's mount and cleanup, so the imperative DOM/rAF lifecycle is
unchanged. The enemy-art glob remains eager within this deferred chunk: making
its synchronous lookup asynchronous would add repaint complexity without
reducing initial image requests or the initial entry.

A temporary source-map size report identified the largest authored modules as
`classes.ts` (73.75 kB source), `run.ts` (27.28 kB), `game.ts` (26.99 kB),
`shop.ts` (21.33 kB), and `drop-gen.ts` (17.12 kB). The generated source data is
larger still: map spawns (1.23 MB), common drops (790 kB), item parameters
(446 kB), shop tables (249 kB), enemy stats (221 kB), rare drops (139 kB), and
room geometry (138 kB before its metadata/coordinate split). Vite minifies and
compresses these numeric tables well, but they keep the raw entry above its
500 kB warning threshold.

The remaining warning is a measured exception. These datasets are reachable
from the synchronous `Game.loadOrNew` → run/replay graph, so `manualChunks`
would merely move required startup code into parallel requests. A future data
split needs one explicit async application-bootstrap boundary that loads and
validates an immutable `SimulationData` bundle before constructing `Game`.
`Game.loadOrNew`, replay, `sendRun`, and `poll` must then receive that already
loaded bundle synchronously; seeded simulation must never perform imports or
observe load timing. Save deserialization can remain synchronous after the
bundle is ready, preserving save shape and deterministic replay.
