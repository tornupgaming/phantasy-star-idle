## 1. Stage Generation Model

- [x] 1.1 Extend the room/stage data model to represent Monest brood metadata without changing persisted save state.
- [x] 1.2 Update stage generation to detect `MONEST` + `MOTHMANT` waves, remove paired Mothmants from normal room splitting, and preserve their count as the brood quota.
- [x] 1.3 Ensure generated stages no longer contain Mothmant-only rooms that originated from a Monest brood.
- [x] 1.4 Add stage-generation tests covering observed Forest offline Monest waves, brood quota preservation, room count behavior, and deterministic output.

## 2. Dynamic Spawn Simulation

- [x] 2.1 Add a structured spawn event payload and run event kind for enemies appended after room entry.
- [x] 2.2 Implement deterministic initial brood burst sizing (2–5, clamped by quota) and Monest placement after a small number of initial Mothmants in target order.
- [x] 2.3 Implement the 5-second Monest brood spawn clock, stopping future spawns when the Monest dies or quota is exhausted.
- [x] 2.4 Ensure already-spawned Mothmants remain normal enemies for combat, XP, meseta, drops, kill events, and room-clear gating.
- [x] 2.5 Add run-simulation tests for initial burst order, periodic spawn timing, Monest death cancelling future spawns, spawned Mothmant rewards, and deterministic replay.

## 3. Scene Reducer and Stage Playback

- [x] 3.1 Update the scene reducer to fold spawn events by appending enemies at their roster index without disturbing existing enemies.
- [x] 3.2 Update stage playback to render spawned enemies incrementally and route later hit/miss/kill feedback to spawned enemy elements.
- [x] 3.3 Update room transition behavior so room events clear the previous room and present the new room's initial roster, while spawn events append within that room.
- [x] 3.4 Add UI/reducer tests for duplicate spawned Mothmants, mid-run reload reconstruction, spawn feedback, and attacks/kills against spawned indices.

## 4. Verification and Tuning

- [x] 4.1 Run the existing deterministic replay, map spawn, combat, and UI scene test suites.
- [x] 4.2 Simulate Forest runs on Normal and spot-check Hard to confirm Monest rooms are urgent but not overwhelming.
- [x] 4.3 Verify no save version bump is needed because active run events remain derived from stored run input and start time.
