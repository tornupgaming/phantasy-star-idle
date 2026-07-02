# Battle Scene View — Tasks

## 1. Structured run events (engine)

- [x] 1.1 Extend `RunEvent` in `src/engine/run.ts` with kind-specific payloads (room: roomIndex/totalRooms/enemy roster with name+maxHp/boxes; attack: actor, targetIndex, hit, crit, damage, hpAfter; kill: enemyIndex, xp; heal/revive: hpAfter), keeping `t`, `kind`, `text` unchanged
- [x] 1.2 Populate the payloads at each emission site in `simulateRun` (room entry, character attack, enemy attack, kill, heal, revive)
- [x] 1.3 Add a test asserting structured payloads are identical across re-simulation of the same input and consistent with the prose (e.g., hpAfter matches the HP printed in `text`)
- [x] 1.4 Run the existing replay/e2e suites and confirm they pass unchanged (payloads are additive; save shape untouched)

## 2. Combo-burst pacing (engine)

- [x] 2.1 Reshape `src/engine/pacing.ts`: add `WEAPON_COMBO_STEP_MS` per weapon type and `COMBO_RECOVERY_MS = 1000`; keep enemy intervals; expose a helper returning the delay to the next character attack given the combo step just performed (recovery after step 3, after a kill-reset, and barehanded equivalents)
- [x] 2.2 Update `charNext` scheduling in `simulateRun` to the burst rhythm: step interval within a combo, step + recovery after the third attack, recovery on kill-reset before retargeting; misses keep burst timing
- [x] 2.3 Add pacing tests covering: three-hit burst timestamps, recovery pause after a completed burst, kill mid-burst → recovery before the next target, miss does not alter timing
- [x] 2.4 Tune step values so average swing rate ≈ current flat intervals (run durations same order of magnitude); update any duration-sensitive test fixtures deliberately and re-verify determinism

## 3. Scene reducer (ui, pure)

- [x] 3.1 Create `src/ui/scene.ts`: `sceneAt(events, charMaxHp)` folding revealed events into `{ roomIndex, totalRooms, enemies: [{name, hp, maxHp, dead}], charHp, charMaxHp, phase }`
- [x] 3.2 Unit-test the reducer: room reset, damage accumulation, duplicate-name enemies resolved by index, kill marks dead, heal/revive restore HP, deterministic fold, mid-run prefix fold equals incremental application

## 4. Battle stage (ui)

- [x] 4.1 Build the stage DOM in the run screen: message ticker (top), enemy field with placeholder boxes + name + HP bar and `data-enemy-id` (middle), player status window with HP bar, room x/y, supplies (bottom); battle log collapsed below
- [x] 4.2 Add stage styles in `src/ui/styles.css`: layout bands, floor plane, HP bar transitions, hit flash/shake, floating damage numbers (crit variant), MISS float, death fade, heal pulse, room-transition interstitial
- [x] 4.3 Implement the rAF playback loop: recompute gameTime from `startedAtWall` each frame, play newly crossed events at their `t` (effects + incremental HP/ticker/log updates), catch up instantly after throttling via the reducer fold
- [x] 4.4 Integrate lifecycle with `UI.render()` and `main.ts`: mount stage once on run start, skip innerHTML rebuilds of the run screen while mounted, cancel rAF and unmount on settle/screen switch; keep the 1 Hz poll as settle/persistence authority
- [x] 4.5 Verify mid-run reload: refresh during a run shows the correct room/HPs immediately and playback continues from now

## 5. Validation and polish

- [x] 5.1 Full suite: `npm test` and `npm run typecheck` green
- [x] 5.2 Watch a full run end-to-end (fast and slow weapon): burst rhythm reads well, effects don't stack broken, eject and complete paths render correctly, post-run report unaffected
- [x] 5.3 Sanity-check run durations and eject rates across areas/difficulties after the pacing change; adjust `WEAPON_COMBO_STEP_MS` if marginal fights flipped
