# Battle Scene View — Design

## Context

The run is pre-simulated: `simulateRun(input)` deterministically produces a timestamped `RunEvent[]`, and the UI reveals a prefix via `revealUpTo(result, gameTime)`. The battle view is therefore a **replay renderer** — no new simulation is needed. Two gaps block it today:

1. `RunEvent` is `{t, kind, text}` — prose only. With duplicate enemies ("Booma ×3") the text cannot unambiguously identify which enemy was hit, so a scene cannot be derived without structured data.
2. `main.ts` re-renders the whole screen at 1 Hz via `innerHTML` replacement, which destroys CSS animations and batches multiple attack events into one visual jolt.

Persistence context: `activeRun` stores only `{input, startedAtWall}`; the `RunResult` (and its events) is recomputed on load. Event shape is derived state — changing it needs **no** `SAVE_VERSION` bump.

Pacing context: `pacing.ts` gives each weapon a flat inter-attack interval (saber 800 ms, sword 1600 ms…). `AttackPattern.comboStepAt` already models 3-step combos for damage, but timing is uniform, which looks lifeless on a stage.

## Goals / Non-Goals

**Goals:**
- PSIV-homage battle stage: ticker top, enemy field middle, player status bottom; placeholder boxes ready to swap for sprites later.
- Structured events sufficient to reconstruct scene state by folding, with `text` retained for the log.
- Smooth event playback at true timestamps; correct mid-run reload (fold past, animate future).
- PSO-inspired combo cadence: 3-hit burst at a per-weapon intra-combo interval, then a fixed 1 s recovery.
- Deterministic replay contract intact: same `(runId, seed)` → identical events and loot.

**Non-Goals:**
- Sprites, art assets, sound (boxes now; `data-enemy-id` hooks for later).
- Any change to combat math (hit/crit/damage formulas untouched).
- Multi-character parties on the stage.
- Retuning the idle economy beyond keeping run durations sane after the cadence change.
- Prep-screen rendering changes (it keeps the existing render path).

## Decisions

### D1. Enrich `RunEvent` with kind-specific payloads (discriminated by `kind`)

Add structured fields per kind, keep `t`, `kind`, `text`:

- `room`: `{ roomIndex, totalRooms, enemies: [{ name, maxHp }], boxes }` — the roster snapshot at entry; array index is the enemy identity for the rest of the room.
- `attack`: `{ actor: "char" | number, targetIndex?, hit, crit, damage, hpAfter }` (`actor` = attacking enemy index; `targetIndex` set when actor is `"char"`; `hpAfter` is the target's HP after the swing, char HP for enemy attacks).
- `kill`: `{ enemyIndex, xp }`
- `heal` / `revive`: `{ hpAfter }`
- `box`, `loot`, `eject`, `complete`: text-only is sufficient (loot keeps its prose; the stage only tickers it).

*Why not parse text?* Ambiguous with duplicate enemy names, brittle, and the data already exists at the emission site. *Why not a parallel event stream?* Two streams must be kept in lockstep; one stream with richer entries is strictly simpler. Payload values are functions of the same RNG draws, so determinism is unaffected.

### D2. Pure scene reducer in `ui/scene.ts`

`sceneAt(events: RunEvent[]) → Scene` where `Scene = { roomIndex, totalRooms, enemies: [{ name, hp, maxHp, dead }], charHp, charMaxHp, phase }` (phase: fighting / looting-boxes / traveling / done). It's a fold: `room` resets the roster, `attack`/`kill`/`heal`/`revive` mutate HPs. Initial char HP comes from the first reveal — pass `charMaxHp` in (from the run input snapshot) rather than emitting a synthetic event.

*Why UI-side, not engine?* It's presentation state; the engine stays free of view concerns (CLAUDE.md rule). It's still pure and unit-tested. *Why a fold rather than incremental mutation only?* The fold gives mid-run reload for free (fold everything ≤ now, animate only what arrives after) and makes the renderer stateless with respect to history.

### D3. Persistent stage DOM + rAF playback; keep the 1 Hz poll for settle

The run screen mounts once into a persistent container. A `requestAnimationFrame` loop computes `gameTime` from `startedAtWall` (same formula as `game.runProgress()`), plays each newly crossed event at its true `t` (flash target box, spawn floating damage number, tween HP bar width, update ticker), and appends log lines incrementally. The existing 1 Hz `setInterval` keeps polling for settle/persistence; `ui.render()` skips rebuilding the stage while the run screen is mounted.

*Why not speed up the innerHTML loop?* Full replacement kills in-flight CSS animations no matter the rate. *Why not a framework/canvas?* Vanilla DOM + CSS transitions is the project's idiom and plenty for boxes-and-bars; canvas would complicate the future sprite swap, not help it.

### D4. Stage layout (PSIV homage)

Three bands: (1) message ticker showing the latest event line; (2) enemy field — a horizontal row of boxes, each `div.enemy[data-enemy-id]` with name label and HP bar beneath, on a floor-plane backdrop; (3) player status window — name, HP bar `current/max`, room progress `R x/y`, supply counts. Battle log collapsed below the stage. Effects: white flash + shake on hit, floating damage number (crits larger/gold), "MISS" float, opacity fade on death, green pulse on heal/revive, brief "Moving to room N…" interstitial on `room`, box-open blips during the loot phase.

### D5. Combo-burst pacing

`pacing.ts` reshapes the character side into two knobs:

- `WEAPON_COMBO_STEP_MS` per weapon type — gap between hits *within* a burst (fast weapons ≈ 250–350 ms, slow ≈ 500–600 ms; roughly PSO's swing animation at 2–3× speed).
- `COMBO_RECOVERY_MS = 1000` shared constant — pause after the 3rd hit before the next burst, standing in for PSO's movement/repositioning time.

In `run.ts`, `charNext` advances by the step interval after combo steps 0 and 1, and by step interval + recovery after step 2. The attack *pattern* (`pattern.typeAt/comboStepAt`) is unchanged — only scheduling changes.

**Kill mid-burst rule:** a kill resets the combo (existing `charAttackIndex = 0`) **and schedules the next swing after the full recovery pause** — retargeting represents repositioning to a new enemy, and starting a fresh burst instantly would make multi-enemy rooms faster per-swing than single-target fights, which reads backwards.

**Misses** advance the combo index (existing behavior) and use the same timing as the step they occupied — a whiffed burst still takes a burst's time.

Net cadence example (saber, 300 ms step): hits at +0.3 s, +0.6 s, then +1.3 s — average ≈ 733 ms/swing vs. today's flat 800 ms, so run durations stay the same order of magnitude; exact numbers are tuned in the pacing table during implementation.

*Alternative considered:* keep flat intervals and fake the burst visually in the UI. Rejected — the log timestamps and the stage would disagree, and the replay contract makes the engine's timeline the single source of truth.

## Risks / Trade-offs

- [Existing tests assert event text/shape or run durations] → Payloads are additive and `text` is unchanged by D1, so replay tests should pass as-is; pacing (D5) *will* shift timestamps and possibly outcomes on marginal fights — rebalance expectations in the pacing table and update affected fixtures deliberately, verifying determinism (same input → same output) rather than frozen timelines.
- [rAF playback drifts from the engine clock] → `gameTime` is recomputed from `startedAtWall` every frame (never accumulated), so drift can't compound; the 1 Hz poll remains the settle authority.
- [Stage DOM leaks across screen switches] → single mount/unmount lifecycle owned by `UI.render()`; the rAF loop is cancelled when the run screen unmounts or the run settles.
- [Recovery pause makes the character strictly weaker against fast enemies] → enemy intervals are untouched and the step intervals are faster than today's flat rate; net DPS is tuned to roughly match current durations. If marginal areas flip to ejects, adjust `WEAPON_COMBO_STEP_MS` in the balancing pass.
- [Tab throttling of rAF while unfocused] → harmless: on refocus the fold catches the scene up instantly; simulation progress never depended on rendering.

## Open Questions

- Exact `WEAPON_COMBO_STEP_MS` values — set provisionally in implementation, confirm by watching a run and checking total run durations against current ones.
- Whether the box-opening phase deserves its own visual beat (box row on the stage) or just ticker lines — default to ticker lines, revisit after seeing it.
