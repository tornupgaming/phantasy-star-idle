## 1. Engine: expose planned room count

- [x] 1.1 Add `totalRooms` to the `RunProgress` interface in `src/engine/game.ts` and populate it in `runProgress()` from the area's static stage definition (no simulation/RNG changes)
- [x] 1.2 Add/extend an engine test asserting `runProgress().totalRooms` equals the area's planned room count even when the pre-simulated result ends in defeat before the last room

## 2. UI: room-based progress bar

- [x] 2.1 Ensure the scene fold retains what the bar needs: current room index, revealed roster size (including spawns), and per-enemy dead flags; retain room `boxes` from room events if currently discarded
- [x] 2.2 Replace the `gameTime / endTime` computation in `tick()` (`src/ui/stage.ts`) with `(roomsCleared + roomKills / roomEnemies) / totalRooms` derived from scene state; clamp to [0, 1] and handle the pre-first-room frame (fill 0)
- [x] 2.3 Replace the `.stage-pct` percentage text with a `Room N/M` label in the bar; remove or fold in the now-redundant bottom-strip `.stage-room-label`
- [x] 2.4 On settlement of a completed run, ensure the bar reads full (N/N); on a defeated run it stops at the last revealed state

## 3. UI: room grid placeholders

- [x] 3.1 Rewrite `updateRooms()` to render `totalRooms` cells sourced from folded room events instead of `RunProgress.roomPlan`; unreached rooms render as `?` placeholders with no enemy/box counts
- [x] 3.2 Mark cells cleared/current from scene state as today; verify revealed cells keep their counts after room transitions and reloads

## 4. Verification

- [x] 4.1 Unit-test the fill computation (pure function over scene state): room boundaries, spawn-grown denominators never regressing across rooms, reload reproducibility
- [x] 4.2 Play-check (verify skill / playcheck agent): dispatch a run known to fail mid-area and confirm the bar stops partway with a full-length `?` grid and no 100%-at-death behavior; confirm a successful run fills to N/N
- [x] 4.3 Run the full test suite and lint
