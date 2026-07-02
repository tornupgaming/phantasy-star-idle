# item-parameter-data Specification (delta)

## MODIFIED Requirements

### Requirement: Weapon kind speed mapping

Every weapon definition SHALL carry its authentic animation category (`WeaponKind`, 19 values: fist, saber, sword, dagger, partisan, slicer, handgun, rifle, mechgun, shot, cane, rod, wand, claw, double-saber, twin-sword, katana, launcher, card). The pacing module SHALL resolve every weapon kind directly to authentic frame-data timings (attack-frame-data capability) keyed by the character's animation rig, the weapon kind, and the attack tier. The former five-archetype lookup table (the designated replacement seam) SHALL be removed.

#### Scenario: Every weapon kind resolves to frame-data timing

- **WHEN** any weapon definition in the dataset is queried for its combo-step timing
- **THEN** its `WeaponKind` resolves through the frame-data accessor (with rig fallback) to authentic step durations, for all 19 kinds

## ADDED Requirements

### Requirement: Attack-speed unit stat exposure

The condensed item dataset SHALL expose the attack-speed percentage of speed units (source stat 19: General/Battle 5, Devil/Battle 10, God/Battle 20, Heavenly/Battle 40) as a typed field on unit definitions. V101, whose speed effect is hardcoded in the original client rather than data-driven, SHALL be normalized to a 40% attack-speed boost at load time, with the special-casing documented at the normalization site.

#### Scenario: Battle units carry their boost

- **WHEN** a unit definition with source stat 19 is loaded
- **THEN** its typed definition exposes the stat amount as an attack-speed boost percentage

#### Scenario: V101 is normalized

- **WHEN** the V101 unit definition is loaded
- **THEN** its typed definition exposes a 40% attack-speed boost despite its source entry using a different stat
