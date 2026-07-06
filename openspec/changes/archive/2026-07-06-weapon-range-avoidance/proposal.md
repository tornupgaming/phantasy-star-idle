# Proposal: weapon-range-avoidance

## Why

The game is measurably harder than authentic PSO because the original's core survival tool — player movement — has no analogue in the sim: every enemy attack on the clock goes straight to the ATA-vs-EVP roll, so the character absorbs each engaged enemy's full theoretical attack rate, where a real PSO player avoided most swings by positioning. Rather than distorting the authentic combat formulas to compensate, we model the missing movement layer directly, and make it a mechanic: longer-range weapons let the "virtual player" keep distance and sidestep more incoming attacks, creating a melee-vs-ranged tradeoff (clear speed vs. survivability) the game currently lacks.

## What Changes

- New per-weapon-kind **avoidance table** (keyed by `WeaponKindName`, same granularity as the attack frame-data table): the chance an incoming enemy attack is sidestepped entirely. Tiered by authentic PSO weapon range — melee lowest (~20%), partisan slightly above, mechgun/shot as close-range guns (~35%), slicer/card mid (~45%), handgun (~50%), launcher (~50%), rifle highest (~55%). Barehanded uses the fist row.
- New **sidestep pre-roll** in the run loop: before an enemy attack resolves, one seeded-RNG draw against the equipped weapon's avoidance; on success the attack is avoided outright (no hit roll, no damage). The authentic combat pipeline (`resolveAttack`) is untouched — the layer sits entirely in front of it.
- New **`sidestep` battle-log event**, distinct from an ATA miss, so the battle scene can present it as movement ("Booma lunges — you sidestep").
- **Weapon avoidance shown in the UI** on weapon cards (shop and equipment) alongside ATP/ATA, so players can reason about the tradeoff.
- **Balance tuning pass** via seeded simulation sweeps: tier ordering/spacing is authored, absolute values are tuned to a target (level-appropriate character clears with modest consumable burn and near-zero death rate, mirroring real PSO); revisit the survival auto-heal threshold afterward.
- Out of scope (deferred): enemy-side avoidance/pressure values, avoidance bonuses on frames/barriers/units, any character-stat-driven avoidance growth.
- Note: the extra RNG draw per enemy attack reshuffles the seeded stream, so pinned replay expectations in tests must be re-pinned. Determinism within a version is unaffected; no persisted-state shape changes (no save version bump).

## Capabilities

### New Capabilities

- `weapon-avoidance`: the per-weapon-kind avoidance table (tiers, values, fist fallback) and the sidestep pre-roll semantics applied to incoming enemy attacks.

### Modified Capabilities

- `run-simulation`: enemy-attack resolution gains the sidestep pre-roll ahead of the authentic pipeline, and a new `sidestep` run event kind is emitted.
- `battle-scene-view`: the scene renders `sidestep` events as a distinct movement beat, not a generic miss.
- `shop-list-card`: weapon cards display the weapon's avoidance value alongside existing stats.
- `character-equipment`: equipped-weapon stat display includes avoidance.

## Impact

- **Engine**: new avoidance data module (e.g. `src/engine/data/avoidance.ts` or alongside frame data); `src/engine/run.ts` enemy-attack branch (pre-roll + event emission + new `RunEventKind`); no changes to `src/engine/combat.ts` formulas.
- **UI**: battle scene event folding (`src/ui/stage.ts` / panes), weapon card stat rows (shop + equipment views).
- **Tests**: new unit tests for the table and pre-roll; re-pin any replay/battle-log expectations affected by the added RNG draw; UI smoke test for the new stat display.
- **Balance**: simulation sweep to set absolute tier values; possible follow-up adjustment to `DEFAULT_SURVIVAL.healThresholdFraction`.
