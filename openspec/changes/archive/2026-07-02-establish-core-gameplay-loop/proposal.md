## Why

I want the moment-to-moment progression of a PSO-style action RPG — send a character into an area, clear rooms of enemies, crack item boxes, chase drops, and grind gear — but *without* the constant hands-on engagement, so it can run alongside other work. This change establishes the MVP game: a solo character you dispatch on **background, self-resolving runs** whose combat uses the real, well-defined PSO damage math, returning to a light meta layer where all the actual decisions (gear, grind, supplies, loot rules) live.

No trademarked names, characters, or assets are used — only the mechanical heart (stats, formulas, run/room/loot structure) is reproduced.

## What Changes

- Introduce a **meta layer** (active): equip gear, grind weapons, stock consumables, configure a loot filter, and pick an area + difficulty, then **send** the character on a run and read a post-run report.
- Introduce a **run simulation** (idle): the character advances room-by-room through an area's rooms; each room is cleared of enemies, then its item boxes open; loot is auto-collected. The run ticks **in the background** (progresses whether or not the view is focused) and is **resumable** from a timestamp, driven by a **seeded RNG** so a re-simulated run reproduces the same battle log and loot.
- Introduce **combat resolution** using the documented PSO formulas: per-attack hit chance (ATA vs. EVP), critical rate (LCK), physical damage `⌊(ATPeff − DFPeff)/5 × 0.9 × mod⌋` with weapon-spread and profession variance, truncation (not rounding), a **two-clock loop** (character and enemy swing on independent cadences by weapon/enemy attack speed), a **configurable attack pattern** (the character auto-combos a player-set Normal/Heavy sequence, since there is no live player to time inputs), and a **hard damage floor** (when `ATPeff ≤ DFPeff` damage is 0 — under-geared = a hard wall that gates difficulty).
- Introduce a **survival / consumables** model: the character auto-quaffs healing items from a pre-stocked supply when HP is low, auto-revives if a revive item is in stock, and — when HP reaches 0 with no supply left — **ejects to the meta layer keeping all loot collected so far**; the run must be manually re-sent. Death costs time, never loot.
- Introduce a **loot economy**: enemy and box drops of meseta, gear, and consumables; a **loot filter** that routes each drop to keep / auto-sell (→ meseta); meseta as the recurring currency spent on consumables and grinders; and weapon **grinding** (`+0…+max`, feeding the `Grind × 2` term in the damage formula).

Explicitly **out of scope** for this MVP (deferred, noted in design): Mags & Photon Blasts, permanent stat Materials, techniques/tech damage, rare-item tekking, Section-ID drop tables, and rich multi-rule loot filters.

## Capabilities

### New Capabilities

- `run-simulation`: The background, tick-based, resumable run engine — room/enemy/box progression, auto-loot triggers, battle-log generation, ejection handling, and deterministic replay from a seeded clock.
- `combat-resolution`: Per-attack PSO combat math (hit / crit / physical damage), the two-clock character-vs-enemy exchange, weapon attack speed, configurable attack patterns, and the damage floor.
- `character-equipment`: The character stat model (ATP/DFP/ATA/EVP/LCK/HP/MST) and equipment — weapons, frame, barrier, units — plus weapon grinding.
- `survival-consumables`: Stocked consumable supply, in-run auto-healing and auto-revive, and the run failure/ejection state machine.
- `loot-economy`: Drop generation, auto-loot resolution, the loot filter (keep / auto-sell), meseta, inventory, and shop purchasing of consumables and grinders.

### Modified Capabilities

_None — this is the initial change; no existing specs._

## Impact

- **Greenfield project.** No existing code; this establishes the initial architecture and data model.
- New systems: a deterministic run simulator, a seeded RNG utility, the combat formula engine, character/equipment/inventory data models, drop tables + loot filter, and the meta-layer control/report surface.
- Foundational decisions (seeded-RNG replay contract, stat model, tick/pacing table) constrain all later features (Mags, Materials, techniques, tekking, Section IDs), so they are documented in `design.md`.
