# drop-generation Delta

## ADDED Requirements

### Requirement: Drop context

Drop generation SHALL be keyed by the dispatched character's section ID, the run's difficulty, and the area (as `area_norm`, where Forest 1 = 0). Boss floors SHALL use the first area of the next section (e.g. the Dragon drops as Caves 1); the final boss SHALL use the last non-boss area. The section ID SHALL be the character's immutable `sectionId`.

#### Scenario: Section ID selects the tables

- **WHEN** two characters with different section IDs run the same area at the same difficulty with the same seed
- **THEN** each run SHALL draw from its own section ID's resolved tables

#### Scenario: Boss floor area adjustment

- **WHEN** a drop is generated on a boss floor
- **THEN** the tables SHALL be indexed with the adjusted area per the boss-floor rule

### Requirement: Enemy drop pipeline

When an enemy dies, the generator SHALL first roll the drop-anything probability (`drop_probs[rt_index]`); on failure nothing drops. On success it SHALL evaluate the enemy's rare specs (each at its normalized probability; first hit wins) and, if none hit, select the item class from `item_classes[rt_index]` (weapon, armor, shield, unit, tool, or meseta) and generate the item. All rolls SHALL use the run's seeded RNG.

#### Scenario: Nothing drops on a failed drop-anything roll

- **WHEN** the drop-anything roll fails for a killed enemy
- **THEN** no rare roll SHALL occur and no item or meseta SHALL drop

#### Scenario: Rare spec hit short-circuits common generation

- **WHEN** the drop-anything roll succeeds and a rare spec for that enemy type hits
- **THEN** the rare item SHALL be minted and no common item-class roll SHALL occur

#### Scenario: Deterministic replay

- **WHEN** the same run (`runId`, seed) is replayed
- **THEN** every drop (kind, item code, grind, bonuses, special, slots, amounts) SHALL be identical

### Requirement: Box drop pipeline

When an item box opens, the generator SHALL evaluate the area's box rare specs (`Box-<Area>`) and, if none hit, select the outcome from the box item-class table (`[item_class][area_norm]`), which includes meseta and empty outcomes, then generate the item. All rolls SHALL use the run's seeded RNG.

#### Scenario: Box can be empty

- **WHEN** the box item-class roll selects the empty class
- **THEN** the box SHALL produce nothing

### Requirement: Common weapon generation

Common weapon drops SHALL follow the authentic pipeline: weapon type from the type probability table; subtype from the subtype-base and subtype-area-length tables (weapon types whose negative base excludes the current area SHALL NOT drop there); grind from the grind table indexed by the position within the subtype's area range; special from the special-mult and special-percent tables; attribute bonuses (native, A.Beast, machine, dark, hit) from the bonus value/spec/type tables with duplicate bonus types deduplicated. The generated weapon SHALL resolve to a valid item code in the item-parameter dataset.

#### Scenario: Area gates weapon subtypes

- **WHEN** a weapon type's subtype base and area length exclude the current area
- **THEN** no weapon of that subtype SHALL be generated in that area

#### Scenario: Generated weapon is a valid item

- **WHEN** any common weapon is generated in any wired scenario
- **THEN** its item code SHALL exist in the item-parameter dataset and its grind SHALL NOT exceed the definition's max grind

### Requirement: Common armor, shield, and unit generation

Common armor SHALL derive its type from `max(area_norm + roll + bias − 3, 0)` with slot count from the slot-count table and DFP/EVP variance rolled within the definition's ranges; shields likewise (without slots); units SHALL be picked uniformly among units whose star count is below the area's max-stars value.

#### Scenario: Armor carries slots and variance

- **WHEN** a common frame is generated
- **THEN** it SHALL carry a slot count from the slot-count table and DFP/EVP within the definition's variance ranges

#### Scenario: Unit stars respect the area cap

- **WHEN** a unit is generated in an area with max-stars N
- **THEN** the unit's star count SHALL be less than N

### Requirement: Tool and meseta outcomes

Tool-class drops SHALL be selected from the tool-class table by area. Mates and Moon Atomizers SHALL route to the run's collected consumables; grinder classes SHALL route to the fungible grinder count; every other tool SHALL mint an inert, sellable tool item carrying its code, name, and sell value. Enemy meseta drops SHALL be rolled from `enemy_rt_index_meseta_ranges[rt_index]` and box meseta from the box meseta ranges by area; the difficulty's meseta multiplier SHALL apply to dropped meseta.

#### Scenario: Usable tools reach the supply

- **WHEN** a tool drop resolves to a Monomate
- **THEN** it SHALL be collected as the existing usable consumable, not as an inert item

#### Scenario: Other tools drop inert

- **WHEN** a tool drop resolves to a Monofluid
- **THEN** an inert tool item with the authentic name and sell value SHALL drop and pass through the loot filter

### Requirement: Rare item minting

Rare drops SHALL be minted from their item code's definition in the item-parameter dataset, with rare bonus generation (spec-5 bonus value rolls with a random area column) and rare grind applied for weapons. Rare drops SHALL always carry the `rare` rarity label.

#### Scenario: Rare weapon carries rare bonuses

- **WHEN** a rare weapon spec hits
- **THEN** the minted weapon SHALL use the authentic definition for its code and its bonuses SHALL be rolled with the rare (spec-5) tables

### Requirement: Generated variance is stored but combat-inert

Generated attribute bonuses, specials, and slot counts SHALL be persisted on the item and shown in item detail UI, and SHALL NOT affect combat resolution in this change.

#### Scenario: Bonuses survive save/load

- **WHEN** a weapon with bonuses is kept and the game is saved and reloaded
- **THEN** the weapon SHALL retain its bonuses, special, and grind

#### Scenario: Combat unchanged by bonuses

- **WHEN** a weapon with a Machine 20% bonus attacks any enemy
- **THEN** damage SHALL be computed exactly as for the same weapon without the bonus
