## Context

Forest spawn data currently enters the run engine as flat waves. Stage generation expands each wave into enemy definition ids, then splits waves larger than `MAX_ROOM_ENEMIES` into several generated rooms. Authentic Monest waves in the extracted Forest layouts are shaped like `MONEST: 1, MOTHMANT: 30`; splitting those waves creates one mixed Monest room followed by several Mothmant-only rooms.

The run engine assumes each room has a fixed roster announced by the `room` event, and the battle scene reducer reconstructs state by folding that fixed roster plus attack/kill/heal/revive events. Monest brood behavior crosses those boundaries: the room starts with only part of the brood visible, then Mothmants appear over time while the Monest remains alive.

## Goals / Non-Goals

**Goals:**

- Preserve authentic spawn data provenance: a Monest wave's Mothmant count remains the brood quota rather than being discarded or invented.
- Prevent generated standalone Mothmant-only rooms that came from a Monest brood.
- Make Monest rooms feel urgent: a small initial brood blocks direct access to the Monest, and additional Mothmants arrive every 5 seconds while the Monest survives.
- Keep deterministic replay: initial brood size/placement and all spawn timings use deterministic simulation state and the run RNG where randomness is required.
- Keep the UI reload-safe by representing dynamic spawns as structured events folded by the scene reducer.

**Non-Goals:**

- Modeling every PSO enemy child-spawn behavior generically.
- Changing authentic enemy stats, XP, meseta, attack math, or drop tables.
- Changing save shape or persisting event logs.
- Adding player-controlled targeting or tactics.

## Decisions

1. **Represent Monest broods in generated room data, not as ordinary Mothmant room entries.**

   Stage generation should detect a wave containing both `MONEST` and `MOTHMANT`. The generated room should keep the Monest and non-brood enemies as room enemies, remove the paired Mothmants from normal splitting, and attach brood metadata containing child id and total quota.

   *Rationale*: The authentic wave is still the source of truth, but the Mothmants become behavior of the Monest encounter rather than hallway population.

   *Alternative considered*: filter out Mothmants entirely. Rejected because it loses authentic pressure, XP/drop opportunities, and the Monest fantasy.

2. **Use a small deterministic initial brood burst with Monest placed inside the target order.**

   On room entry, the simulation should create 2–5 Mothmants from the brood quota in quick succession. The Monest should be placed after a small number of those initial Mothmants in roster/target order, e.g. one to three children before it, clamped by the initial burst. Remaining initial burst children appear after the Monest. The exact burst size/placement may be RNG-derived, but must use the run RNG and remain stable for identical `(runId, seed)` inputs.

   Example target order: `[Mothmant, Mothmant, Monest, Mothmant, Mothmant]`.

   *Rationale*: The current character targeting rule attacks the first living roster enemy. Placing a few Mothmants before the Monest creates urgency without burying the source behind the full brood.

   *Alternative considered*: put Monest at index 0. Rejected because strong characters would shut off the brood before the room reads as a nest encounter.

3. **Spawn one additional Mothmant every 5 seconds while the Monest is alive.**

   After the initial burst, each Monest brood owns a spawn clock. If the Monest is alive and the brood quota is not exhausted, the clock appends one Mothmant to the room every 5000 game ms. Killing the Monest cancels future spawns. Already-spawned Mothmants remain ordinary enemies: they attack, can be killed, can drop loot, award dataset XP, and must be cleared before boxes open.

   *Rationale*: Five seconds gives enough time for strong characters to limit the brood by killing the source, while weaker characters see escalating pressure.

   *Alternative considered*: spawn after each Mothmant death. Rejected because it couples pressure to the player's DPS in a less readable way and can feel like a fixed queue rather than a living source.

4. **Append spawned enemies with a structured `spawn` event.**

   Add a run event kind for dynamic enemy appearance. A spawn event should include the appended enemy's room roster index, id, display name, and max HP. Attack and kill events continue to use roster indices. Room events announce the initial roster only; spawn events extend the roster deterministically.

   *Rationale*: This matches the conceptual model of Mothmants appending to the room and keeps the scene reducer pure.

   *Alternative considered*: predeclare all 30 Mothmants in the room event as hidden/pending. Rejected because it makes room counts and UI state misleading and forces the scene to understand invisible enemies.

5. **Let existing engagement throttling handle combat concurrency.**

   Spawned Mothmants should enter the same combat scheduling model as other enemies. The existing `ENGAGED_ENEMIES` behavior can prevent all living enemies from attacking simultaneously; dynamic spawns should not introduce a separate concurrency cap unless testing shows Monest rooms become unfair.

   *Rationale*: Avoids stacking two independent throttling models. The primary design knobs are Monest placement, 5-second cadence, and authentic brood quota.

## Risks / Trade-offs

- **Higher difficulties may turn protected Monests into long attrition rooms** → Keep the Monest pre-index small and add simulation tests/spot checks across difficulties before tuning further.
- **Dynamic roster indices can become a source of off-by-one replay bugs** → Treat append order as the single identity source; add reducer and replay tests for duplicate Mothmants and mid-run reload.
- **Room strip enemy counts may become misleading** → Count initial enemies only or document the count as visible/initial enemies; avoid showing 30-brood totals as standalone rooms.
- **Multiple Monests in one wave would complicate brood ownership** → Handle the observed Forest case first; if multiple Monests appear, deterministically split or assign the brood quota per source and cover with tests.
- **Event kind expansion touches UI and engine tests** → Events are derived state, so save migration is not required; tests should lock determinism instead.
