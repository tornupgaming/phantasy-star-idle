## Why

The run progress bar is a spoiler: it fills as `gameTime / endTime`, and on a doomed run `endTime` is the death timestamp — so the bar races to 100% while the character is still mid-area, telegraphing failure before it happens. The room grid leaks the same way: it renders one cell per room the character actually reached in the pre-simulated result, so a doomed run visibly shows fewer cells than the area total from the first frame.

## What Changes

- The stage progress bar becomes room-based instead of time-based: fill = `(roomsCleared + killsInCurrentRoom / enemiesInCurrentRoom) / totalRooms`, derived from revealed events. A failing run's bar simply stops partway and settles — no oracle.
- The bar's percentage text is replaced by a `Room N/M` style label (a percent of elapsed-time no longer exists; a percent of rooms is a misleading unit).
- The room grid always renders the area's total room count; rooms not yet entered render as `?` placeholders (their enemy/box composition genuinely hasn't been rolled yet) and reveal their contents when the character enters.
- `RunProgress` gains a `totalRooms` field sourced from the area's stage definition (static data, no RNG, no save-shape change).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `battle-scene-view`: run progress presentation must reflect rooms cleared out of the area's total room count and must not reveal the run's outcome or remaining duration; the room grid must show all planned rooms with unreached rooms as unknown placeholders.

## Impact

- `src/ui/stage.ts` — progress bar computation (`tick`), `updateRooms`, and the bar label markup.
- `src/engine/game.ts` — add `totalRooms` to the `RunProgress` interface and `runProgress()` (read from the area's stage definition; no simulation or RNG changes).
- No save version bump: persisted state shape is unchanged. Replay determinism untouched — the simulation itself is not modified.
