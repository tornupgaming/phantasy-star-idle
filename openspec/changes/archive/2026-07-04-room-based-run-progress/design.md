## Context

Runs are fully pre-simulated at dispatch (`simulateRun` in `src/engine/run.ts`); the UI replays events revealed up to the current game time. Two UI elements currently leak the pre-computed outcome:

- The progress bar (`src/ui/stage.ts:126`) fills as `gameTime / result.endTime`. On a doomed run `endTime` is the death timestamp, so the bar approaches 100% mid-area — an oracle for failure.
- The room grid (`updateRooms`, `stage.ts:266`) renders one cell per `roomPlan` entry, but `roomPlan` (`run.ts:394`) is only populated for rooms actually reached. A doomed run shows fewer cells than the area total from the first frame.

Constraints: replay determinism (same `(runId, seed)` → identical log/loot) forbids rolling unreached rooms' compositions early, so a "time if successful" denominator is unobtainable and unreached rooms' contents are genuinely unknown. The scene is a pure fold over revealed events and must survive reload.

## Goals / Non-Goals

**Goals:**
- Progress bar measures rooms cleared out of the area's planned room count, smooth via within-room kill interpolation.
- Room grid always shows the full planned room count, unreached rooms as `?` placeholders.
- No observable difference between a doomed and a successful run before settlement.

**Non-Goals:**
- No changes to the simulation, RNG order, or event stream.
- No save version bump (persisted state shape unchanged).
- No redesign of the bar's visual styling beyond the label.

## Decisions

**1. Room-based fill with kill interpolation (over pure room-count or segmented bar).**
`fill = (roomsCleared + roomKills / roomEnemies) / totalRooms`. A pure room-count bar jumps in 1/N steps and sits still between rooms; a segmented bar duplicates the room grid. Kill interpolation needs only data already in the scene fold: the current room's roster (including spawns) and per-enemy dead flags. `roomEnemies` is the *revealed* roster size — spawned enemies (e.g., Monest broods) grow the denominator as they appear, which can make the fraction dip slightly; acceptable, since it never moves backwards across rooms.

**2. Compute fill from the scene state, not from a new engine calculation.**
The scene reducer already tracks `roomIndex`, `totalRooms`, and enemy alive/dead per revealed events. Deriving fill in `stage.ts` keeps the "pure fold over revealed events" invariant and gives reload-reproducibility for free. The engine change is limited to exposing `totalRooms` on `RunProgress` (from the area's static stage definition — no RNG) so the bar and grid work before the first room event arrives and independently of the truncated `roomPlan`.

**3. Replace the `%` text with `Room N/M`.**
"85%" of rooms is a misleading unit and percent-of-time no longer exists. The bottom-strip room label (`.stage-room-label`) becomes redundant with the bar label; fold it into the bar (keep the element wired but display room counts in the bar's text slot).

**4. Room grid renders `totalRooms` cells; contents come from revealed room events, not `roomPlan`.**
`updateRooms` currently reads `roomPlan` (truncated, spoiler). Instead render `totalRooms` cells and fill each cell's enemy/box counts from the room events the scene has folded (room events carry `boxes` and the enemy roster). Unreached cells show `R{n}` with `?` instead of counts. This also removes the UI's only dependence on `roomPlan`; `RunProgress.roomPlan` can be dropped or kept for the settlement report — keep it, but the stage stops reading it.

## Risks / Trade-offs

- [Bar dips when spawns grow the current room's denominator] → Accept; dips are small, within-room only, and never regress past a cleared-room boundary. Alternative (freeze denominator at room entry) would show 100%-of-room with live enemies standing.
- [Players may still infer doom from HP trends] → Out of scope; HP display is honest information about the present, not a leaked future.
- [Scene must know room box counts for revealed cells] → Room events already carry `boxes`; if the scene reducer currently discards it, retain it in the fold (reducer-only change, deterministic).

## Migration Plan

Pure UI + one additive engine field; ship in one commit. No data migration, no save bump. Rollback = revert.

## Open Questions

None.
