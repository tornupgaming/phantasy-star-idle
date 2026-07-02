## Why

Authentic Forest layouts encode Monest encounters as a Monest plus a large Mothmant brood, but the current wave-to-room splitting turns that single encounter into chains of standalone Mothmant rooms. That is less PSO-like and creates dull pacing; Mothmants should feel like pressure emitted by a living Monest, not independent room population.

## What Changes

- Treat Mothmants paired with a Monest in map spawn data as a Monest brood rather than normal room enemies.
- Generate Monest rooms with a small initial brood burst: 2–5 Mothmants appear in quick succession when the room begins.
- Place the Monest after a small number of initial Mothmants in target order so the character must clear some brood before reaching the source, creating urgency without burying the Monest behind the full brood.
- While the Monest remains alive, spawn one additional Mothmant every 5 seconds until the authentic brood quota is exhausted.
- Killing the Monest stops future Mothmant spawns; already-spawned Mothmants remain real enemies that must be defeated and grant their normal minimal rewards.
- Add structured run events and scene reducer behavior for dynamically appended enemies so the battle view remains deterministic and reload-safe.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `run-simulation`: Dynamic Monest brood spawning changes room combat progression, battle-log structured events, deterministic replay, and room generation semantics.
- `battle-scene-view`: The scene reducer and stage must handle enemies appended after room entry.

## Impact

- Affected engine code: `src/engine/stage-gen.ts`, `src/engine/areas.ts`, `src/engine/run.ts`, and related tests for deterministic replay/stage generation.
- Affected UI code: `src/ui/scene.ts`, `src/ui/stage.ts`, and reducer/playback tests for spawned enemies.
- No save-version bump expected: active runs persist only the input/start timestamp; events and scene state remain derived by deterministic simulation.
- No new runtime dependencies.
