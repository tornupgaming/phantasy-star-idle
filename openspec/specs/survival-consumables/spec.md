# survival-consumables Specification

## Purpose
Handle pre-run consumable stocking and in-run survival: auto-healing, auto-revive, and loot-preserving ejection. (TBD: refine as the capability evolves.)

## Requirements

### Requirement: Pre-run consumable supply
The player SHALL stock a supply of consumables (at least healing items and optional revive items) for a run before dispatching the character. The dispatched run SHALL use a snapshot of that supply.

#### Scenario: Stocked supply is bound to the run
- **WHEN** the player stocks healing and revive items and sends the character
- **THEN** the run SHALL carry that quantity of consumables and SHALL deplete only that snapshot during the run

### Requirement: In-run auto-healing
When the character's HP falls to or below a healing threshold and a healing item is in the run's supply, the system SHALL automatically consume one healing item and restore HP.

#### Scenario: Auto-quaff on low HP
- **WHEN** the character's HP drops to or below the healing threshold and at least one healing item remains
- **THEN** the system SHALL consume one healing item, restore the item's heal amount to the character's HP, and log the heal

#### Scenario: No heal available
- **WHEN** the character's HP is low and no healing item remains
- **THEN** the system SHALL NOT heal and combat SHALL continue

### Requirement: Auto-revive
When the character's HP reaches 0 and a revive item is in the run's supply, the system SHALL automatically consume one revive item and restore the character to continue the run.

#### Scenario: Revive on death when available
- **WHEN** the character's HP reaches 0 and at least one revive item remains
- **THEN** the system SHALL consume one revive item, restore the character's HP, and continue the run

### Requirement: Ejection preserves all loot
When the character's HP reaches 0 and no revive item remains, the run SHALL end by ejection, returning the character to the meta layer while keeping every item and meseta collected during the run. Ejection SHALL NOT cost any collected loot.

#### Scenario: Wipe returns loot intact
- **WHEN** the character's HP reaches 0 with no revive item remaining
- **THEN** the run SHALL end as **ejected**, all loot collected so far SHALL be retained, and a run report SHALL be shown

#### Scenario: Re-send is manual
- **WHEN** a run has ended by ejection
- **THEN** the system SHALL require the player to manually send the character again to retry; the run SHALL NOT auto-restart

### Requirement: Authentic consumable roster with inert entries
The consumable roster SHALL expand to cover the items the authentic tool shop stocks (mates, fluids, sol/moon/star atomizers, antidotes/antiparalysis, and other recovery-row entries), ingested now even where no game system consumes them. Entries whose effects are unimplemented SHALL be purchasable, counted in the shared supply, and sellable, but SHALL NOT be consumable in runs and SHALL NOT be auto-used by survival logic.

#### Scenario: Inert consumable is buyable but never used
- **WHEN** the player buys a Monofluid and dispatches a run
- **THEN** the purchase SHALL succeed and the supply count increase, and the run SHALL never consume it (no TP system exists yet)

#### Scenario: Implemented consumables keep working
- **WHEN** the roster expands
- **THEN** existing healing and revive behavior for mates and Moon Atomizers SHALL be unchanged
