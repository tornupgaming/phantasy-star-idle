# attack-frame-data Specification

## Purpose
Ship authentic PSO attack-animation frame data (transcribed from the archived pioneer2.net frame-data tables) as a generated dataset with a reproducible extraction pipeline, exposed to the engine as integer-millisecond timings keyed by animation rig, weapon kind, attack tier, and combo step, with speed-boost interpolation between the two measured anchors.

## Requirements

### Requirement: Frame-data dataset with two measured anchors

The engine SHALL ship a frame-data dataset transcribed from the archived pioneer2.net wikitext snapshot (`Game_mechanics/Frame_data`, checked into the repo), recording attack-animation frame counts at 30 frames per second. For each animation rig, weapon kind, and attack tier (Normal, Heavy) the dataset SHALL hold, per combo step, the **Combo** frame count (attack chains into a next step; steps 1–2) and the **Full** frame count (the combo ends on this attack; steps 1–3), at both measured speed anchors: 0% and +40% ("V101") animation speed. The dataset SHALL be a faithful transcription: cells present in the wiki carry the wiki's exact values.

#### Scenario: Measured cells match the wiki

- **WHEN** the dataset is queried for a rig/kind/tier/step combination the wiki measured (e.g. Male saber Normal step-1 Full)
- **THEN** it returns the wiki's exact frame count at each anchor (29 at +40%, 32 at 0% for the example)

### Requirement: Reconstruction of unmeasured 0% cells

Where the wiki provides no 0% measurement for a rig/kind/tier (13 of 19 weapon kinds), the extraction pipeline SHALL reconstruct the 0% frame count as `round(frames40 × medianRatio[position])`, where `medianRatio` is the per-combo-position median of 0%/40% ratios computed from all rig/kind/tier cells measured at both anchors. Reconstructed cells SHALL be marked as such in the emitted dataset. Reconstruction SHALL occur only in the extraction script, never at runtime.

#### Scenario: Missing 0% cell is reconstructed and marked

- **WHEN** the extraction pipeline processes a weapon kind with only +40% measurements (e.g. rifle)
- **THEN** the emitted 0% cells are derived from that kind's +40% values via the per-position median ratios and carry a `reconstructed` marker

#### Scenario: Measured 0% cells are never overwritten

- **WHEN** a rig/kind/tier has wiki-measured 0% data
- **THEN** the emitted 0% cells are the measured values, unmarked

### Requirement: Reproducible extraction pipeline

A repo script SHALL parse the checked-in wikitext snapshot and emit the dataset as standard JSON under `src/engine/data/`, runnable via an npm script. Re-running the extraction against the same snapshot SHALL be byte-identical. The snapshot file SHALL carry a header noting its source URL and retrieval date.

#### Scenario: Extraction is deterministic

- **WHEN** the extraction script runs twice against the pinned snapshot
- **THEN** the emitted JSON is byte-identical

### Requirement: Millisecond constants computed once from frames

The engine-facing frame-data module SHALL convert frame counts to integer game-milliseconds exactly once, at module initialization, as `round(frames × 1000 / 30)`. All runtime pacing consumers SHALL see only integer milliseconds; frame counts SHALL NOT leak into the simulation.

#### Scenario: Runtime values are integer milliseconds

- **WHEN** any pacing consumer requests a step duration
- **THEN** it receives an integer millisecond value derived from the frame count by the single conversion rule

### Requirement: Typed accessor with rig fallback

The frame-data module SHALL expose a total, typed accessor keyed by animation rig, weapon kind (all 19), attack tier, combo step, and combo/full flavor. Rigs are: male, female, HUcaseal, RAmarl, FOmar, FOmarl. A rig lacking an entry for a weapon kind SHALL fall back to the male rig's entry (the wiki's stated convention). Special attacks SHALL resolve to Heavy timing. The accessor SHALL be total: every rig × kind × tier × step combination resolves to a value.

#### Scenario: Sparse rig falls back to male

- **WHEN** timing is requested for a rig/kind combination the wiki lists only under Male (e.g. Female sword)
- **THEN** the male rig's values are returned

#### Scenario: Special resolves to Heavy

- **WHEN** timing is requested for a special attack
- **THEN** the Heavy tier's values are returned

### Requirement: Speed-boost interpolation between anchors

Effective step duration at an attack-speed boost `p` percent (0 ≤ p ≤ 40) SHALL be computed by integer fixed-point interpolation between the two anchors: `ms(p) = ms0 − round((ms0 − ms40) × p / 40)`. The formula SHALL reproduce the 0% anchor exactly at p=0 and the +40% anchor exactly at p=40, and SHALL be deterministic (integer inputs, single rounding).

#### Scenario: Anchors reproduce exactly

- **WHEN** duration is computed at p=0 or p=40
- **THEN** the result equals the corresponding anchor's millisecond constant exactly

#### Scenario: Intermediate boosts interpolate monotonically

- **WHEN** duration is computed at p=5, 10, or 20 for the same cell
- **THEN** each result lies between the two anchors and durations do not increase as p increases
