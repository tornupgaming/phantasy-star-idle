# item-parameter-data Delta

## MODIFIED Requirements

### Requirement: Typed loader over the dataset

The engine SHALL expose the dataset only through a typed loader (`src/engine/data/item-table.ts`) providing per-kind definition types and code-based lookups, a stars→rarity bucket mapping (0–3 common, 4–8 uncommon, ≥9 rare) that preserves the raw star value, and an adapter producing a `GearTemplate` from an item code for weapons, frames, barriers, and units. The loader SHALL additionally expose tool definitions (code, name, cost-derived sell value) for drop generation and inert tool items. Mag entries are extracted but SHALL NOT be consumed by the engine.

#### Scenario: Definition lookup by code

- **WHEN** a known weapon code is requested
- **THEN** the loader returns a typed definition with authentic stats, requirements, name, group, stars, and derived rarity

#### Scenario: Template adapter bridges to the item model

- **WHEN** a gear template is built from an item code
- **THEN** it is a valid `GearTemplate` with `minAtp` = ATP min, `spread` = ATP max − ATP min, rarity from the star bucket, sell value derived from the sale divisor, and equip requirements carried over

#### Scenario: Tool definition lookup by code

- **WHEN** a known tool code (e.g. Monofluid) is requested
- **THEN** the loader returns a typed tool definition with its authentic name and sell value
