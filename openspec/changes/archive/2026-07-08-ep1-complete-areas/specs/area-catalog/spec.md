# area-catalog Specification (delta)

## ADDED Requirements

### Requirement: Ep1 per-floor area catalog
The selectable area catalog SHALL contain one area per Episode 1 floor: Forest 1, Forest 2, Cave 1, Cave 2, Cave 3, Mine 1, Mine 2, Ruins 1, Ruins 2, Ruins 3, and the four boss arenas (Dragon, De Rol Le, Vol Opt, Dark Falz). Each area SHALL be wired to its authentic floor's free-play spawn layouts and SHALL carry a zone group (Forest, Caves, Mines, Ruins), a display name, and a recommended ATP value. Boss arenas SHALL belong to their authentic zone's group (Dragon → Forest, De Rol Le → Caves, Vol Opt → Mines, Dark Falz → Ruins) and SHALL be ordered after the zone's regular floors. Recommended ATP SHALL be monotonically non-decreasing within each zone group.

#### Scenario: All fourteen areas are selectable
- **WHEN** the selectable area catalog is enumerated
- **THEN** it SHALL contain exactly the ten regular Ep1 floors and four boss arenas, each resolving to its authentic episode-1 floor number

#### Scenario: Zone grouping and order
- **WHEN** the catalog is enumerated in display order
- **THEN** areas SHALL appear grouped by zone in the order Forest, Caves, Mines, Ruins, with each zone's regular floors in floor order followed by that zone's boss arena

### Requirement: Boss arenas are single-boss areas
A boss arena SHALL generate a stage whose enemy content is exactly one boss enemy — Dragon, De Rol Le, Vol Opt (ver. 2 stat rows), or Dark Falz (final-form stat rows) — using that boss's authentic per-difficulty stats from the enemy stat dataset. Multi-part boss anatomy (body segments, mines, pillars, monitors, Darvant waves) SHALL NOT be simulated.

#### Scenario: Boss run fights exactly one enemy
- **WHEN** a run is dispatched to a boss arena at any difficulty
- **THEN** the generated stage SHALL contain exactly one enemy, the arena's boss, instantiated from its authentic stat row for that difficulty

### Requirement: Stage generation covers the full Ep1 spawn-type set
Every spawn type appearing in any Ep1 floor's free-play layouts SHALL either resolve to an enemy roster definition or appear on an explicit skip list of stat-less gadget/part types (Dubwitch, the Ruins bee emitters, the Dark Gunner control unit, Darvant, and the De Rol Le / Vol Opt body parts). Skipped types SHALL be silently dropped during stage generation; spawn types that are neither rostered nor skip-listed SHALL fail stage generation loudly.

#### Scenario: Every Ep1 area generates without error
- **WHEN** a stage is generated for any of the fourteen Ep1 areas with any seed
- **THEN** generation SHALL complete with every room enemy resolving to a roster definition backed by authentic stats at all four difficulties

#### Scenario: Skip-listed gadget types are dropped
- **WHEN** a spawn wave contains a skip-listed type (e.g. Dubwitch in Mine 2, Darvant in the Dark Falz arena)
- **THEN** the generated rooms SHALL NOT contain that type and no error SHALL be raised

#### Scenario: Unknown spawn types still fail loudly
- **WHEN** a spawn wave contains a type that is neither in the enemy roster nor on the skip list
- **THEN** stage generation SHALL throw an error identifying the type and area

### Requirement: Ep1 rare enemy variants
Rare-variant rolls SHALL cover the authentic Ep1 pairs: Rag Rappy → Al Rappy, Poison Lily → Nar Lily, Hildebear → Hildeblue, and Pofuilly Slime → Pouilly Slime, at the established per-spawn rare rate drawn from the run's seeded RNG.

#### Scenario: Hildeblue can replace Hildebear
- **WHEN** stage generation processes a Hildebear spawn and the seeded rare roll hits
- **THEN** the generated enemy SHALL be a Hildeblue with its own authentic stat rows

### Requirement: Legacy area ids remain resolvable
The three pre-catalog area ids (`forest`, `caves`, `mines`) SHALL continue to resolve to their original definitions — including the Dragon boss floor glued to `mines` — for persisted references (active-run replay and settled-run reports), while being excluded from the selectable catalog. Persisted save shape SHALL be unchanged by this feature.

#### Scenario: Mid-run legacy save replays identically
- **WHEN** a save containing an active run dispatched to a legacy area id is loaded
- **THEN** the run SHALL resume and replay the identical stage, battle log, and loot as before the catalog change

#### Scenario: Legacy ids are not offered
- **WHEN** the selectable area catalog is enumerated
- **THEN** `forest`, `caves`, and `mines` SHALL NOT appear
