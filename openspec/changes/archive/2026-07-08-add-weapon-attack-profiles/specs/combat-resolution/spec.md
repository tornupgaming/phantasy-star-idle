# combat-resolution Specification (delta)

## ADDED Requirements

### Requirement: Multi-hit combo steps
A character combo step SHALL comprise one or more hits per the equipped weapon's attack profile. Each hit SHALL resolve independently through the full existing pipeline — its own accuracy roll, critical roll, and damage draws (Wvar, Pvar) from the run's seeded RNG. The combo-step accuracy modifier (1.0 / 1.3 / 1.69) SHALL apply to every hit within that step. RNG draws SHALL occur in a fixed order — targets in roster order, then hits in sequence against each target — so identical inputs reproduce identical outcomes.

#### Scenario: Hits within a step resolve independently
- **WHEN** a mechgun performs a combo step of 3 hits
- **THEN** each hit SHALL roll accuracy, critical, and damage independently, so a single step can contain any mix of hits, misses, and criticals

#### Scenario: Step accuracy modifier applies to all hits in the step
- **WHEN** a multi-hit weapon performs the third combo step
- **THEN** every hit in that step SHALL use the third step's 1.69 accuracy modifier

#### Scenario: Multi-hit resolution is deterministic
- **WHEN** the same run input is re-simulated
- **THEN** the per-hit outcomes (hit/miss, critical, damage) SHALL be identical across re-simulations
