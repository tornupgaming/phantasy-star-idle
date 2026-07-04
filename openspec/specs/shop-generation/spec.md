# shop-generation Specification

## Purpose
Generate authentic Pioneer 2 shop inventory for the three counters (weapon/armour/tool) from the extracted newserv shop tables: level-tiered picks, section-ID weighting, attribute rolls, level-derived shop difficulty, and deterministic (characterId, level) seeding.

## Requirements

### Requirement: Shop difficulty derives from character level
Shop generation SHALL select its difficulty from the character's current level: 0–19 Normal, 20–39 Hard, 40–79 Very Hard, 80+ Ultimate. This is a documented concession: authentic PSO keys shop stock off the hosting game's difficulty; this game keys it off character level, independent of the run difficulty the player selects.

#### Scenario: Level maps to shop difficulty
- **WHEN** stock is generated for characters at levels 19, 20, 79, and 80
- **THEN** the weapon shop SHALL use the Normal, Hard, Very Hard, and Ultimate weapon tables respectively

### Requirement: Deterministic stock seeded by character and level
Each shop stock SHALL be generated from a seeded RNG stream keyed by shop kind, character id, and character level, and SHALL restock exactly when the character's level changes. The same (characterId, level) SHALL always reproduce identical stock; the three shops SHALL draw from independent streams.

#### Scenario: Same inputs, same stock
- **WHEN** stock is generated twice for the same character id, level, and shop kind
- **THEN** the offers SHALL be identical, item for item, including rolled attributes

#### Scenario: Restock on level-up
- **WHEN** a character's level increases by one
- **THEN** all three of that character's shop stocks SHALL be regenerated for the new level

### Requirement: Armor shop generation
The armour counter SHALL stock armors, shields, and units drawn from the extracted armor random-set tables using newserv's logic: level-tier index at thresholds 11/26/43/61; counts of 4/6/7 armors and 4/5/6/7 shields and 0/3/5/6 units at thresholds 11/26/43; weighted subtype picks with duplicate rejection; armor slot counts rolled from the authentic slot-count table; no DFP/EVP variance (base stats); and on Ultimate shop difficulty, armor and shield subtypes bumped +2 at character level above 99 and +3 above 150.

#### Scenario: Counts follow the level tier
- **WHEN** stock is generated for characters at levels 10, 25, and 43
- **THEN** the armour counter SHALL hold 4/6/7 armors, 4/5/6 shields, and 0/3/5 units respectively

#### Scenario: Shop armor has base stats
- **WHEN** an armor is generated for the shop
- **THEN** its DFP and EVP SHALL equal the item definition's base values with no variance roll, and its slot count SHALL come from the authentic slot-count probability table

### Requirement: Tool shop generation
The tool counter SHALL stock, per newserv's logic: every item of the common-recovery row for the character's level tier (thresholds 11/26/45/61/100) as always-available stock; at level 11 and above, two weighted rare-recovery picks where drawing "Nothing" reduces the target count once; and 4/5/7 technique disks (thresholds 11/43) picked from the weighted tech-disk table, each with a level rolled per the tech-disk level table's mode for that technique and tier — including newserv's intentionally non-uniform min/max range roll — and duplicate technique numbers rejected.

#### Scenario: Common recovery row is fixed stock
- **WHEN** tool stock is generated for a given level tier
- **THEN** every non-empty entry of that tier's common-recovery row SHALL be present

#### Scenario: Tech disk level from divisor mode
- **WHEN** a technique whose level table entry is a player-level divisor N is stocked for a character of level L
- **THEN** the disk's level SHALL equal clamp(min(L, 99) / N − 1, 0, 14) + 1 in display terms, matching newserv's calculation

### Requirement: Weapon shop generation
The weapon counter SHALL stock 10/12/16 weapons (level thresholds 11/43) drawn from the extracted weapon tables for the level-derived shop difficulty, using newserv's logic: level-tier index with 5 tiers (7 on Ultimate, extending past level 100 and 151); weapon type picked from the weight table row for the character's section ID; grind rolled from the default range, or the favored range when the type matches the section ID's favored weapon type, clamped to the weapon's max grind; a special rolled via the special-mode table (none / low tier / high tier); two percent bonuses rolled from the bonus type and range tables with the second rerolled on duplicate type; at most two entries of the same weapon type; and every weapon sold tekked.

#### Scenario: Section ID shapes the weapon pool
- **WHEN** weapon stock is generated for two characters of the same level but different section IDs
- **THEN** each SHALL draw from its own section ID's weight row of the weapon type table

#### Scenario: Favored weapon type grinds higher
- **WHEN** a stocked weapon's type matches the character's section ID favored type
- **THEN** its grind SHALL be rolled from the favored grind range table instead of the default range

#### Scenario: Weapons are sold identified
- **WHEN** any weapon is generated for the shop
- **THEN** it SHALL be marked tekked with its special and bonuses visible

### Requirement: Tech disks are purchasable inert items
Technique disks SHALL be purchasable and enter the shared inventory as tool items carrying their technique id and disk level. They SHALL be sellable but not usable; learning and casting techniques is out of scope and deferred.

#### Scenario: Bought disk lands in inventory
- **WHEN** the player buys a technique disk from the tool counter
- **THEN** an inert tool item carrying the technique id and level SHALL be added to the shared inventory and the price deducted

### Requirement: Weapons carry tekked state
Weapon instances SHALL carry a tekked flag, ingested now for later use. All currently minted weapons (shop and drops) SHALL be tekked; untekked drops and the tekker are future changes. Items saved before the flag existed SHALL be treated as tekked.

#### Scenario: Legacy weapons read as tekked
- **WHEN** a save containing weapons without a tekked field is loaded
- **THEN** those weapons SHALL behave as tekked
