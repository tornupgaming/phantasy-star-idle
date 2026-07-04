# survival-consumables Delta

## ADDED Requirements

### Requirement: Authentic consumable roster with inert entries
The consumable roster SHALL expand to cover the items the authentic tool shop stocks (mates, fluids, sol/moon/star atomizers, antidotes/antiparalysis, and other recovery-row entries), ingested now even where no game system consumes them. Entries whose effects are unimplemented SHALL be purchasable, counted in the shared supply, and sellable, but SHALL NOT be consumable in runs and SHALL NOT be auto-used by survival logic.

#### Scenario: Inert consumable is buyable but never used
- **WHEN** the player buys a Monofluid and dispatches a run
- **THEN** the purchase SHALL succeed and the supply count increase, and the run SHALL never consume it (no TP system exists yet)

#### Scenario: Implemented consumables keep working
- **WHEN** the roster expands
- **THEN** existing healing and revive behavior for mates and Moon Atomizers SHALL be unchanged
