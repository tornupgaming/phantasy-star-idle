# item-parameter-data Specification (delta)

## ADDED Requirements

### Requirement: Armour stat ceilings exposed to consumers
The typed loader SHALL expose a pure helper that resolves an armour item (frame or barrier) to its stat ceiling — base DFP/EVP plus the definition's variance range already present in the dataset — keyed by the item's authentic code. The helper SHALL return no ceiling (null) for items without a code or without range data in the dataset, and SHALL NOT mutate items or persisted state.

#### Scenario: Ceiling from dataset ranges

- **WHEN** the helper resolves a frame whose dataset entry has base DFP 30 with range 5 and base EVP 15 with range 5
- **THEN** it returns a ceiling of DFP 35 and EVP 20

#### Scenario: No range data

- **WHEN** the helper resolves an armour item with no code or no dataset range
- **THEN** it returns null and callers can fall back to flat display
