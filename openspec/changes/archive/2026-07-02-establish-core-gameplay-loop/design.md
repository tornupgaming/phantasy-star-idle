## Context

Greenfield idle ARPG. The design target is the PSO gameplay loop — dispatch a character, clear rooms, loot, grind gear — with **minimal required attention** so it runs beside other tasks. That constraint drives every decision below: the run must resolve itself, tick in the background, and survive a reload, while all player agency is pushed into a pre-run/post-run meta layer.

Combat math is not invented; it reproduces the documented PSO formulas (see `https://wiki.pioneer2.net/w/Game_mechanics`). Only mechanics are reused — no trademarked names or assets.

## Goals / Non-Goals

**Goals:**
- A complete, satisfying loop: send → background run → auto-loot → report → improve build → send harder.
- Runs progress in the background and resume correctly after a reload/close, with the replayed battle log matching what a live viewer would have seen.
- Combat is authentic PSO math and therefore naturally non-deterministic (hit/crit/spread/profession dice) — the log feels alive without artificial variance.
- Failure is low-stakes: a wipe costs run time, never collected loot.
- Four decisions carry the game: what to equip, how far to grind, how much supply to stock, and what the loot filter keeps.

**Non-Goals (deferred to later changes):**
- Mags & Photon Blasts (a parallel pet/stat track).
- Permanent stat Materials (capped permanent base-stat growth).
- Techniques and tech damage formulas.
- Rare-item tekking / identification gambling.
- Section-ID-specific rare drop tables.
- Rich multi-rule loot filters (per-stat thresholds, auto-feed).
- Multiplayer / party (the game is solo by design).

## Decisions

### D1 — Solo character, not a party
PSO is 4-player co-op; this is a single character. Rationale: drastically simpler sim and UI, and it keeps "build" as one coherent decision. Alternative (party) multiplies combat bookkeeping and synergy balancing for little idle benefit.

### D2 — Runs tick in the background and resume from a seeded RNG
A run is a function of `(character snapshot, area, seed, elapsed time)`. The sim advances on a game clock regardless of view focus; on reload it fast-forwards from the last saved timestamp.
Because we adopt real PSO combat (D3), combat *is* random — so replay determinism **requires** every random draw to pull from one reproducible stream keyed to `(runId, seed)`. This is the single most foundational contract: get it wrong and reloaded runs desync the log from the loot. Alternative (deterministic thin combat) was considered and rejected once we chose real PSO math, which gives free "aliveness."

### D3 — Real PSO combat formulas
Per-attack pipeline: **hit** `Accuracy = ATAeff − EVPeff×0.2` (ATAeff scales by attack type × combo step); **crit** `min(LCK,100)/5%` for the character, `min(LCK,100)/2%` for enemies; **damage** `⌊(ATPeff − DFPeff)/5 × 0.9 × atkMod⌋` where `ATPeff = [BaseATP + Wvar×WSpread]×(1+SA) + EQATP + Pvar` and `EQATP = [WATP,min + Grind×2 + FATP + BaATP]×(Watr+1)`. Damage **truncates**, never rounds. Attribute % applies only to a weapon's minimum ATP.

### D4 — Configurable attack pattern (no live combo timing)
Real PSO combos require player timing; there is no live player. The character auto-executes a **player-configured sequence** of Normal/Heavy attacks (e.g. `N-N-H`). Later combo steps get higher accuracy multipliers (1.0 / 1.3 / 1.69), so a Heavy finisher lands more reliably — a genuine, cheap build decision.

### D5 — Two-clock combat exchange
Character and enemy each swing on their own cadence set by an attack-speed value (per weapon type for the character, per enemy type for the enemy). We author these speed values ourselves (PSO's are animation frames at 30 FPS and not in scope to port exactly); this table is the primary **pacing knob** and creates the fast-weak vs. slow-strong build tension.

### D6 — Hard damage floor (difficulty gate)
When `ATPeff ≤ DFPeff`, damage is 0. Under-gearing an area is a **hard wall**, not a slow grind. This is the intended difficulty gate: a wipe means "go re-gear," and the meta layer is where you respond. Alternative (min-1 damage) rejected — it lets you brute-force content the design wants gated.

### D7 — Healing is a stocked, auto-used consumable supply
Before a run the player stocks healing items (and optional revive items). In-run: HP low → auto-quaff; HP 0 → auto-revive if a revive item remains; else **eject to meta layer keeping all loot**, requiring a manual re-send. This gives meseta its core recurring sink, makes run length a supply-vs-damage curve, and enriches failure ("under-geared **or** under-supplied") without contradicting the keep-all-loot rule.

### D8 — Loot filter with auto-sell (MVP scope)
Every drop passes a filter that routes it to keep or auto-sell (→ meseta). MVP is a simple threshold/rule (e.g. auto-sell junk below a bar; always keep rares). This prevents background runs from overflowing inventory and is the set-and-forget mechanic that makes long AFK sessions viable. Richer rules are deferred.

### D9 — MVP progression = Gear + Grind only
The proven engine is: find/equip better gear, and grind weapons `+0…+max`. Materials and Mag are the longevity layer, deliberately deferred so the core loop can be validated first.

### D10 — Stack: TypeScript + Vite + Vitest, runtime-agnostic engine
The simulation engine (`src/engine/*`) is pure TypeScript with **no DOM or Node dependency** so it runs identically in a browser tick, a test, or an offline catch-up pass — this is what makes the seeded-replay contract (D2) enforceable and testable. The browser app (Vite, vanilla DOM — no UI framework) is a thin presentation layer over the engine; persistence goes through a small `Storage` port (localStorage in the browser, in-memory in tests). Vitest drives the formula/replay tests. Rationale: idle games are naturally web apps (background ticking via timestamps, `localStorage` saves), and keeping the engine pure keeps the foundational contracts unit-testable without a headless browser.

### D11 — Run is a pure function of its input; the clock only reveals it
`simulateRun(input) → { events[], loot, outcome, endTime }` is a deterministic, event-driven function of `(character snapshot, area, difficulty, supply, seed)`. Combat is stepped by a min-heap of next-attack times (character before enemies on ties, enemies by index) rather than a fixed timestep, so ordering is exact and timestep-independent. "Background ticking" and "offline resume" are just advancing a wall-clock-derived game time `T` and revealing events with `t ≤ T`; loot/meseta are committed to persistent state only when the run reaches a terminal state (complete/ejected). Re-simulating from the seed reproduces the identical timeline (task 7.5).

### D12 — Pacing & offline catch-up (balancing outcomes)
Balancing pass (tasks 9.2/9.3) settled on `GAME_SPEED = 1` (1 real ms = 1 game ms) with the attack-speed table in `pacing.ts`: a starter forest run resolves in ~25s, mid-tier caves in ~1 min — the intended "start it, do a task, glance back" cadence — while under-geared attempts at higher areas/difficulties eject (the D6 wall working as a gate). Offline catch-up uses **capped accrual** (`OFFLINE_CAP_MS`, 12h) but the dominant safeguard is structural: runs never auto-restart (D7), so any single absence yields at most one completed run's worth of loot regardless of duration. Long-absence abuse is therefore bounded by design, not just by the cap.

## Risks / Trade-offs

- **Seeded-replay desync** → Centralize all randomness behind one seeded RNG service keyed to `(runId, seed)`; forbid ad-hoc `Math.random()` in sim code; test that re-simulating a saved run reproduces the identical log + loot.
- **Deterministic-feeling runs** → Mitigated by D3: real PSO dice make outcomes wobble naturally; no extra variance needed.
- **Wipe re-send feels like busywork** → A wipe is meant to be rare once appropriately geared/supplied (D6/D7); if wipes recur, that's the signal to tune the build, which is the intended loop, not friction.
- **Background/offline time abuse** → Cap or rate-limit simulated offline catch-up so closing for a week doesn't trivialize progression (tune during balancing).
- **Pacing feels wrong** → D5's attack-speed table is isolated and data-driven so run duration can be retuned without touching combat math.
- **Scope creep from deferred systems** → Explicit Non-Goals; the seeded-RNG, stat-model, and pacing contracts are chosen to leave room for Mags/Materials/techs/tekking/Section-IDs later.

## Open Questions

- **Section ID**: fixed at character creation (identity, farm one table) vs. switchable (roam for any rare). Only matters once rare drop tables exist — defer to the drop-table change.
- **Offline catch-up policy**: full simulate vs. capped accrual vs. abstracted summary for very long absences — decide during balancing.
- **Attack-speed values**: exact per-weapon-type and per-enemy-type cadences — a balancing pass, not an architecture decision.
- **Inventory cap size** and whether a bank/storage exists in MVP or arrives with the richer loot systems.
