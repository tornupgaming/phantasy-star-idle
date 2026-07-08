# run-simulation Specification

## Purpose
Simulate dispatched runs: room-by-room progression through an area, auto-looting, background ticking, deterministic seeded resume, and a battle log. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Dispatching a character on a run
The system SHALL allow the player to dispatch the selected roster character into a selected area at a selected difficulty from the meta layer, starting a run that resolves without further input. There SHALL be a single global run slot shared across the whole roster.

#### Scenario: Send starts a run
- **WHEN** the player selects an area and difficulty and presses "send"
- **THEN** the system creates a run bound to the selected character's id and a snapshot of that character's derived stats, equipment, and stocked supply, assigns the run a unique id and RNG seed, and begins advancing it

#### Scenario: Only one active run at a time
- **WHEN** a run is already active
- **THEN** the system SHALL NOT start a second run for any roster character and SHALL require the active run to end (complete or eject) first

#### Scenario: Run resolves for its own character
- **WHEN** a run ends while a different character is selected
- **THEN** the run's XP and any equipment effects SHALL apply to the character that was dispatched, and loot/meseta SHALL flow to the shared economy

### Requirement: Room-by-room progression
An area SHALL consist of an ordered list of rooms, each containing zero or more enemies and zero or more item boxes. The run SHALL clear rooms in order.

#### Scenario: Room must be cleared of enemies before boxes open
- **WHEN** the character enters a room containing enemies
- **THEN** the system SHALL resolve combat against those enemies before any item box in that room is opened

#### Scenario: Boxes open only after the room is clear
- **WHEN** a room has no remaining living enemies
- **THEN** the system SHALL open every item box in that room and resolve their drops, then advance the character to the next room

#### Scenario: Reaching the end completes the run
- **WHEN** the character clears the final room of the area
- **THEN** the run SHALL end as **complete** and return the character to the meta layer with a run report

### Requirement: Monest broods spawn Mothmants dynamically
When authentic spawn data pairs Mothmants with a Monest in a generated room, the system SHALL treat those Mothmants as a Monest brood quota rather than as ordinary room enemies or standalone generated rooms.

#### Scenario: Brood Mothmants do not become standalone rooms
- **WHEN** stage generation processes a spawn wave containing one Monest and one or more Mothmants assigned to that Monest brood
- **THEN** the generated stage SHALL include the Monest encounter as a room and SHALL NOT create later Mothmant-only rooms from that brood quota

#### Scenario: Initial brood burst protects the Monest
- **WHEN** the character enters a generated Monest brood room with at least two brood Mothmants available
- **THEN** the simulation SHALL spawn 2–5 Mothmants in quick succession at room start, clamped by the brood quota, and SHALL place the Monest after a small deterministic number of those Mothmants in the room's target order

#### Scenario: Brood continues while Monest lives
- **WHEN** the Monest remains alive after the initial brood burst and brood quota remains
- **THEN** the simulation SHALL append one additional Mothmant to the room every 5 seconds of game time until the Monest dies or the brood quota is exhausted

#### Scenario: Killing Monest stops future brood spawns
- **WHEN** the Monest in a brood room is defeated
- **THEN** the simulation SHALL stop spawning additional Mothmants from that brood, and already-spawned Mothmants SHALL remain living enemies until defeated

#### Scenario: Spawned Mothmants are normal enemies
- **WHEN** a spawned Mothmant attacks, is attacked, is defeated, or drops loot
- **THEN** it SHALL use the same combat, XP, meseta, drop, and kill-event rules as a Mothmant that was present at room entry

### Requirement: Auto-loot on kill and on box open
Loot SHALL be collected automatically; the player never manually grabs items during a run.

#### Scenario: Enemy drop collected on death
- **WHEN** an enemy's HP reaches 0
- **THEN** the system SHALL immediately resolve and collect that enemy's drop (routed through the loot filter) before continuing

#### Scenario: Box drop collected on open
- **WHEN** an item box is opened
- **THEN** the system SHALL resolve and collect its drop (routed through the loot filter)

### Requirement: Background ticking
A run SHALL progress on a game clock independently of whether its view is focused or visible.

#### Scenario: Progress continues while unfocused
- **WHEN** the run view is not focused and game time elapses
- **THEN** the run SHALL continue advancing rooms, combat, and loot at the same rate as when focused

### Requirement: Deterministic resume from a seed
A run SHALL be reconstructible from its stored `(character snapshot, area, seed, start time)` such that re-simulating elapsed time reproduces the identical battle log and loot.

#### Scenario: Reload mid-run reproduces state
- **WHEN** the application is closed and reopened while a run was in progress
- **THEN** the system SHALL fast-forward the run to the current game time and the resulting battle log and collected loot SHALL be identical to an uninterrupted run

#### Scenario: All randomness is seeded
- **WHEN** any random outcome occurs during a run (hit, miss, crit, damage variance, drop roll)
- **THEN** the value SHALL be drawn from the run's seeded RNG stream and SHALL NOT use any non-reproducible source of randomness

### Requirement: Battle log
The system SHALL produce a human-readable, scrollable log of run events (attacks, hits/misses, crits, sidesteps, kills, dynamic enemy spawns, box opens, loot, heals, ejection) that the player MAY read or ignore. Each event SHALL additionally carry structured, machine-readable data sufficient to reconstruct the battle scene state (initial room composition, dynamically appended enemies, per-enemy HP, character HP) without parsing the human-readable text.

#### Scenario: Log records combat, dynamic spawns, and loot events
- **WHEN** an enemy dynamically spawns, an attack lands, an attack is sidestepped, an enemy dies, a box opens, or loot is collected
- **THEN** the system SHALL append a corresponding entry to the run's battle log

#### Scenario: Room events carry the initial enemy roster
- **WHEN** the character enters a room
- **THEN** the room event SHALL include the room index, total room count, and the initial list of enemies with their names and max HP, in a fixed order that identifies each initial enemy by roster index

#### Scenario: Spawn events append enemies to the roster
- **WHEN** an enemy appears after room entry
- **THEN** the spawn event SHALL include the appended enemy's roster index, enemy id, name, and max HP, and that index SHALL identify the enemy for subsequent attack and kill events in that room

#### Scenario: Attack events identify actor, target, and outcome
- **WHEN** an attack is resolved
- **THEN** the attack event SHALL include the actor (character, or which enemy by index), the target (by index when the character attacks), whether it hit, whether it was a critical, the damage dealt, and the target's HP after the attack — unambiguous even when a room contains multiple enemies with the same name

#### Scenario: Sidestep events identify the avoided attacker
- **WHEN** an incoming enemy attack is sidestepped
- **THEN** the log SHALL record a `sidestep` event, distinct from a missed attack event, whose structured payload identifies the attacking enemy by roster index, and no health value SHALL change as a result of the event

#### Scenario: Kill, heal, and revive events carry resulting state
- **WHEN** an enemy is defeated, or the character is auto-healed or revived
- **THEN** the kill event SHALL identify the defeated enemy by index and its XP award, and heal/revive events SHALL include the character's HP after the event

#### Scenario: Structured payloads preserve determinism and persistence shape
- **WHEN** the same run input is re-simulated
- **THEN** the structured payloads SHALL be identical across re-simulations, and the persisted save shape SHALL be unchanged (events remain derived state, recomputed from the stored run input)

### Requirement: Four selectable difficulties
The game SHALL offer four run difficulties — Normal, Hard, Very Hard, and Ultimate, in that order — all freely selectable. Very Hard SHALL sit between Hard and Ultimate with a meseta multiplier of 3 (within the existing 1/2/4 curve), and runs at Very Hard SHALL use the authentic `vhard` enemy stat rows and the Very Hard drop tables.

#### Scenario: Very Hard run uses authentic data
- **WHEN** a character is dispatched at Very Hard
- **THEN** enemies SHALL instantiate from the `vhard` stat rows and drops SHALL roll from the Very Hard drop tables, with meseta scaled ×3

#### Scenario: No unlock gate
- **WHEN** a new character views the difficulty picker
- **THEN** all four difficulties SHALL be selectable (under-geared characters are gated only by ejection)

### Requirement: Weapon attack profile fan-out
A character swing SHALL fan out according to the equipped weapon's attack profile: it SHALL strike up to the profile's maximum-target count of living enemies, selected in roster order starting from the first living enemy, and SHALL perform the profile's per-step hit count against each struck target. Striking a queued (not yet engaged) enemy SHALL NOT change engagement. Each hit SHALL emit its own attack log event using the existing attack event payload (actor, target index, hit, critical, damage, target HP after). A target killed mid-swing SHALL receive no further hits from that swing, its kill handling (XP, drop, engagement advance) SHALL run immediately, and remaining hits SHALL NOT retarget within the swing. The swing SHALL bill exactly one frame-data step duration regardless of hit and target counts, and the combo SHALL advance once per swing.

#### Scenario: Multi-hit swing emits one attack event per hit
- **WHEN** a character with daggers (2 hits per step) performs a combo step against an enemy
- **THEN** the battle log SHALL contain two attack events for that swing, each with its own hit/critical/damage outcome and the target's HP after that hit

#### Scenario: Sweep strikes multiple living enemies in roster order
- **WHEN** a character with a sword (max 4 targets) swings in a room with three living enemies
- **THEN** the swing SHALL resolve one hit against each of the three enemies in roster order, and each hit SHALL be logged with its target's roster index

#### Scenario: Sweep does not engage queued enemies
- **WHEN** a sweep damages a living enemy that has not yet been engaged
- **THEN** that enemy SHALL remain queued (its attack clock SHALL NOT start) until engagement advances through the existing kill-replacement rule

#### Scenario: Target killed mid-swing receives no overkill hits
- **WHEN** the first hit of a multi-hit step reduces its target to 0 HP
- **THEN** the kill event (XP, drop, engagement advance) SHALL occur immediately, the remaining hits of that step SHALL NOT strike the dead target, and they SHALL NOT be redirected to another enemy

#### Scenario: Combo resets only when the primary target dies
- **WHEN** a sweep kills a secondary target but the primary target (the first target of the swing) survives
- **THEN** the combo SHALL continue to the next step; **AND WHEN** the primary target dies the combo SHALL reset and the swing SHALL bill its Full duration plus the repositioning pause

#### Scenario: Fan-out does not change swing timing
- **WHEN** a mechgun (3 hits per step) and a saber (1 hit per step) each perform a first-step Normal attack with the same rig and speed boost
- **THEN** each swing SHALL bill only its own weapon kind's frame-data step duration, independent of the number of hits performed
