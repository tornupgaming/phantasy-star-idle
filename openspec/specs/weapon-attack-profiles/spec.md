# weapon-attack-profiles Specification

## Purpose
Define per-weapon-kind attack profiles — hits per combo step and maximum targets per swing — that combat resolution and run simulation use to fan out character attacks. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Per-weapon-kind attack profile table
The engine SHALL define an attack profile per authentic weapon kind consisting of two independent axes: the number of hits performed at each combo step (`[step1, step2, step3]`) and the maximum number of targets struck per swing. Any weapon kind without an authored profile SHALL use the default profile of 1 hit per step and 1 target. A weapon SHALL resolve to its profile via its authentic weapon kind (fist when barehanded).

#### Scenario: Authored multi-hit profiles
- **WHEN** the attack profile is resolved for dagger, double-saber, mechgun, twin-sword, or card
- **THEN** the hits per combo step SHALL be dagger 2-2-2, double-saber 2-1-3, mechgun 3-3-3, twin-sword 1-2-2, card 1-1-3, each with a maximum of 1 target

#### Scenario: Authored multi-target profiles
- **WHEN** the attack profile is resolved for sword, partisan, slicer, or shot
- **THEN** the profile SHALL be 1 hit per combo step with a maximum-target count greater than 1 (initial values: sword 4, partisan 3, slicer 4, shot 5)

#### Scenario: Default profile for other kinds
- **WHEN** the attack profile is resolved for any other weapon kind (e.g. saber, handgun, rifle) or for a barehanded character
- **THEN** the profile SHALL be 1 hit per combo step and 1 maximum target
