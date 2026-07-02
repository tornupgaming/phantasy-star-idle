## 1. Project foundation

- [x] 1.1 Choose stack/runtime and scaffold the project (build, run, test) — decision recorded in design if it deviates
- [x] 1.2 Implement a seeded RNG service (deterministic stream keyed to `(runId, seed)`); forbid ad-hoc randomness in sim code via lint/convention
- [x] 1.3 Set up a persistent save/load layer (character, inventory, meseta, active run) with timestamps for background/offline resume

## 2. Character & equipment data model

- [x] 2.1 Define the character stat model (ATP, DFP, ATA, EVP, LCK, MST, HP) with base + effective stat computation
- [x] 2.2 Define item types: weapon (WATP,min, WSpread, Watr, ATA, attack speed, grind, max grind), frame (DFP/EVP, unit slots), barrier, unit
- [x] 2.3 Implement equipment slots and equip/unequip with slot and unit-count validation
- [x] 2.4 Implement weapon grinding (apply grinder, +1 up to max, feeds `Grind × 2`)

## 3. Combat resolution engine

- [x] 3.1 Implement hit resolution (`ATAeff = ATAtotal × attackType × comboStep`; accuracy = `ATAeff − EVPeff×0.2`; guaranteed/impossible bounds)
- [x] 3.2 Implement critical resolution (character `LCK/5%`, enemy `LCK/2%`, ×1.5)
- [x] 3.3 Implement physical damage (`EQATP`, `ATPeff` with Wvar/WSpread/SA/Pvar, `DFPeff` with ZL, `⌊…/5×0.9×mod⌋`, truncation, attribute-on-min-ATP, hard 0 floor)
- [x] 3.4 Implement the configurable attack pattern (repeating Normal/Heavy sequence, combo-step reset)
- [x] 3.5 Implement the two-clock exchange (independent character/enemy attack cadences; enemy→character uses the pipeline in reverse)
- [x] 3.6 Unit-test formulas against worked PSO examples (including truncation and the 0-damage wall)

## 4. Enemy & area content model

- [x] 4.1 Define enemy data (HP, ATP, DFP, EVP, LCK, attack speed, drop table)
- [x] 4.2 Define area model as an ordered list of rooms; each room has enemies + item boxes
- [x] 4.3 Author an initial set of areas and a difficulty modifier scheme (enemy stat scaling, drop-table selection)
- [x] 4.4 Author an initial attack-speed table for weapon types and enemy types (the pacing knob)

## 5. Survival & consumables

- [x] 5.1 Define consumable types (healing items with heal amount; revive items) and the player's stock
- [x] 5.2 Implement pre-run supply snapshot bound to the run
- [x] 5.3 Implement in-run auto-heal at the HP threshold and auto-revive on 0 HP when available
- [x] 5.4 Implement the run failure/ejection state machine (0 HP + no revive → eject, keep all loot, require manual re-send)

## 6. Loot & economy

- [x] 6.1 Implement seeded drop generation for enemies and boxes from drop tables
- [x] 6.2 Implement the loot filter (auto-sell-below-value + always-keep-rare) routing drops to keep/auto-sell
- [x] 6.3 Implement meseta balance, item sell values, and inventory (view/equip/sell)
- [x] 6.4 Implement shop purchasing of consumables and grinders (price deduction, insufficient-funds rejection)

## 7. Run simulation engine

- [x] 7.1 Implement run creation on "send" (snapshot character/equipment/supply, assign runId + seed, enforce single active run)
- [x] 7.2 Implement room-by-room progression (clear enemies → open boxes → advance → complete on final room)
- [x] 7.3 Wire auto-loot triggers (on enemy death, on box open) through the loot filter
- [x] 7.4 Implement the game clock: background ticking and fast-forward resume from saved timestamp
- [x] 7.5 Verify deterministic replay — re-simulating a saved run reproduces identical log + loot (test)
- [x] 7.6 Generate the battle log (attacks, hits/misses, crits, kills, boxes, loot, heals, ejection)

## 8. Meta layer (control surface)

- [x] 8.1 Build the loadout/prep view (equip gear, grind, stock consumables, configure loot filter, pick area + difficulty, send)
- [x] 8.2 Build the run view (scrollable, ignorable battle log; live/background progress)
- [x] 8.3 Build the post-run report (loot, meseta gained, consumables used, complete vs. ejected)
- [x] 8.4 Build a basic map/room view rendering (text or minimal) reflecting current room progress

## 9. Integration & balancing pass

- [x] 9.1 End-to-end playtest of the full loop (send → run → auto-loot → report → re-gear → send harder)
- [x] 9.2 Tune attack-speed/pacing so a run lands in a "start it, do a task, glance back" cadence
- [x] 9.3 Decide and implement an offline catch-up policy (simulate vs. capped accrual) to prevent long-absence abuse
- [x] 9.4 Validate the change (`openspec validate establish-core-gameplay-loop --strict`)
