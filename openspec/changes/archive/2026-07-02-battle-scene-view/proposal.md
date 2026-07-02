# Battle Scene View — Proposal

## Why

The run view is a text-only battle log — accurate but boring to watch. A classic Phantasy Star (PSIV-style) first-person battle scene — enemies with HP bars in a room, the character's status window below, attacks flashing as they land — makes the idle run worth spectating without the overkill of a full PSO 2D view. Alongside it, the current flat attack cadence (one evenly spaced swing every N ms) reads as lifeless on screen; a PSO-inspired combo rhythm (quick 3-hit burst, then a recovery pause) gives the scene the authentic beat.

## What Changes

- **Structured run events**: `RunEvent` grows kind-specific structured payloads (room → enemy roster with name/maxHp; attack → actor, target index, hit/crit/damage/HP-after; kill → enemy index/XP; heal/revive → HP-after) alongside the existing human-readable `text`. Events are derived, never persisted (`activeRun` stores only `{input, startedAtWall}`), so **no save version bump**.
- **PSIV-style battle stage**: new run-screen centerpiece — message ticker on top, enemy field in the middle (placeholder boxes with name + HP bar, hit flashes, floating damage numbers, MISS text, death fade, `data-enemy-id` hooks for future sprites), player status window at the bottom (HP bar, room progress, supplies). The scrollable battle log is demoted below the stage.
- **Pure scene reducer** (`ui/scene.ts`): folds revealed structured events into the current scene state (room, enemy HPs, character HP), unit-testable, enabling correct mid-run reload/resume.
- **Incremental run-screen rendering**: the run screen moves off the 1 Hz full `innerHTML` re-render to a persistent DOM updated via `requestAnimationFrame`, playing each event at its true timestamp `t`.
- **Combo-burst pacing model**: the character attacks in 3-hit combo bursts — quick per-weapon intra-combo intervals — followed by a fixed recovery pause (~1 s, standing in for PSO movement/repositioning time). Enemy cadence stays interval-based. The deterministic replay contract holds; run durations will shift and are retuned via the pacing table.

## Capabilities

### New Capabilities

- `battle-scene-view`: the PSIV-homage visual battle stage — scene layout, per-event visual effects, scene state derived purely from revealed run events, smooth playback and mid-run resume.

### Modified Capabilities

- `run-simulation`: the battle log requirement extends to structured event payloads (machine-readable data alongside the human-readable text) sufficient to reconstruct scene state without parsing prose.
- `combat-resolution`: the two-clock exchange changes on the character side from a flat per-weapon interval to a combo-burst cadence (per-weapon intra-combo interval + fixed post-combo recovery), including the rule for what happens when a kill resets the combo mid-burst.

## Impact

- `src/engine/run.ts` — event emission gains payloads; `charNext` scheduling switches to combo-burst timing.
- `src/engine/pacing.ts` — pacing table reshaped: per-weapon intra-combo interval + shared recovery constant; enemy intervals unchanged.
- `src/ui/scene.ts` (new) — pure event-fold scene reducer.
- `src/ui/views.ts`, `src/ui/styles.css`, `src/main.ts` — run screen becomes a persistent, rAF-driven stage; prep screen and 1 Hz poll loop for settle/persistence remain.
- `tests/` — replay determinism must keep passing; new tests for the scene reducer and combo pacing; any test asserting event shape or run duration gets updated.
- No persistence impact: `SAVE_VERSION` unchanged (event shape is derived state).
