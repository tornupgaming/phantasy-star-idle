# Design: weapon-range-avoidance

## Context

In authentic PSO, player movement avoids most incoming enemy attacks; the ATA-vs-EVP roll only ever applied to attacks the player failed to dodge. Our sim has no movement layer: `src/engine/run.ts` fires each engaged enemy's attack on a flat clock (`ENEMY_ATTACK_INTERVAL_MS`) and pipes every one straight into `resolveAttack`, so the character absorbs full theoretical enemy DPS. The engine already made one movement concession — `ENGAGED_ENEMIES = 1` (only one enemy attacks concurrently) — but the avoidance half is missing, which is why survival needs an aggressive 0.65 auto-heal threshold and heavy consumable burn.

Constraints: the authentic combat formulas in `src/engine/combat.ts` must remain byte-identical (CLAUDE.md rule); all randomness goes through the run's seeded RNG; the UI is presentation-only; no persisted-state shape change without a save version bump.

## Goals / Non-Goals

**Goals:**

- Model "the player moved" as a per-weapon-kind sidestep chance applied before the authentic hit pipeline, restoring effective incoming DPS to something like authentic-play levels.
- Make it a legible mechanic: a melee-vs-ranged tradeoff (clear speed vs. survivability) that is visible on weapon cards and felt in the battle scene.
- Keep replays deterministic within a version and keep the save shape unchanged.

**Non-Goals:**

- Enemy-side avoidance/pressure values (deferred; the design leaves an explicit seam).
- Avoidance bonuses from frames, barriers, or units.
- Character-stat- or level-driven avoidance growth — avoidance is purely equipment-driven so EVP keeps its job as the growth stat.
- Any change to `combat.ts` formulas, EVP coefficients, enemy ATP, or attack cadences.

## Decisions

### D1: Avoidance is a per-weapon-kind table keyed by `WeaponKindName`

A new engine data module (`src/engine/data/avoidance.ts`) exports `AVOIDANCE_PCT: Record<WeaponKindName, number>` plus a lookup `weaponAvoidancePct(weaponKind: number | null): number` that maps the numeric kind via `WEAPON_KIND_NAMES` and treats `null` (barehanded) as `fist` — the same convention pacing uses with `FIST_KIND`. Authored tiers (ordering and spacing are the authored contract; absolute values are the tuning knob, see D5):

| Tier | Kinds | Avoid % |
|---|---|---|
| Melee, point-blank | fist, saber, dagger, claw, sword, double-saber, twin-sword, katana | 20 |
| Melee with reach | partisan | 25 |
| Force melee | cane, rod, wand | 20 |
| Close-range gun | mechgun, shot | 35 |
| Thrown / mid | slicer, card | 45 |
| Mid-range gun | handgun | 50 |
| Artillery | launcher | 50 |
| Long-range gun | rifle | 55 |

Rationale: `WeaponKindName` is exactly the granularity the frame-data table already uses, so the mechanic slots in as a sibling of attack timing and every weapon (including archetype-fallback weapons via `KIND_FOR_ARCHETYPE`) resolves to a row. Alternative — a per-item avoidance field — rejected for now: a table default keeps data in one place and leaves per-item overrides (rare weapons) as a compatible future extension.

### D2: Sidestep is a pre-roll in the run loop, not a formula change

In the enemy-attack branch of `run.ts` (currently `resolveAttack(e.combatant, charCombatant, …)`), draw once from the run RNG against the equipped weapon's avoidance **before** calling `resolveAttack`. On success, emit a `sidestep` event and skip the attack entirely (no hit roll, no damage, no crit draw); the enemy's next-attack clock still advances normally. On failure, the authentic pipeline runs untouched.

Rationale: the layer models exactly what was lost (positioning) and leaves every authentic formula intact — landed hits still do authentic, scary damage. Alternatives rejected: raising the EVP coefficient (distorts the authentic hit formula and warps EVP itemization), scaling enemy ATP (distorts the damage formula and the 0-damage wall), lengthening enemy intervals (changes pacing feel, enemies read as sluggish).

The weapon kind is snapshotted at dispatch (run.ts already derives `weaponKind` once from the character snapshot), so avoidance is fixed for the run — consistent with how attack timing and speed boost work.

### D3: `sidestep` is a first-class run event

Add `"sidestep"` to `RunEventKind` with a structured payload identifying the attacking enemy by roster index (`{ sidestep: { actor: number } }`), human text like `"Booma lunges — you sidestep."`. It is deliberately distinct from a miss `attack` event: a miss is the enemy failing the ATA roll; a sidestep is the virtual player moving. The battle scene renders it as its own beat (an evade indicator on the character, no health-bar change), and log/ticker lines keep muted styling like misses.

Events remain derived state recomputed from the stored run input, so the save shape is unchanged — no `SAVE_VERSION` bump. The added RNG draw per enemy attack reshuffles the seeded stream relative to the previous version; within-version determinism is unaffected, but pinned battle-log/replay expectations in tests must be re-pinned once.

### D4: Avoidance is displayed as an AVD stat wherever weapon stats show

Shop cards get an AVD chip in the weapon chip row (styled like the existing attribute chips; always shown since every weapon has a value); the equipment/detail views show the same value on the equipped weapon and in swap previews. Rationale: the mechanic creates a real purchase/equip tradeoff, so it must be visible where those decisions are made — an invisible survivability stat would read as RNG.

### D5: Absolute values are tuned by simulation against an explicit target

Tier ordering and relative spacing are authored (D1); the absolute scale is tuned with seeded simulation sweeps toward: a level-appropriate character clears the early areas with modest consumable use and a near-zero death rate (mirroring real PSO), melee clears meaningfully faster while ranged burns meaningfully fewer consumables, and neither side dominates both axes. After tuning, revisit `DEFAULT_SURVIVAL.healThresholdFraction` (0.65 was set to survive full incoming DPS and can likely relax).

### D6: Enemy-side seam left open

When enemy avoidance-pressure lands later, it subtracts inside the same roll (`clamp(weaponAvoid − enemyPressure)`); the lookup helper takes only the weapon kind today so the signature change is contained to one call site.

## Risks / Trade-offs

- [Ranged strict dominance — a rifle with comparable clear speed and 55% avoidance makes melee dead inventory] → the tuning pass (D5) explicitly checks the clear-speed-vs-consumable-burn Pareto; melee's frame-data DPS and higher-ATP weapons must stay the fast-clear option.
- [RNG stream shift breaks pinned test expectations] → one-time re-pin of affected fixtures; document in tasks. No cross-version replay guarantee exists to preserve.
- [Chip-row clutter on weapon cards] → AVD is one compact chip consistent with the existing chip language; if the row overflows on narrow layouts, the tuning/UI task may drop it from the card and keep it in the detail view.
- [Sidestep spam in the battle log at high avoidance] → sidestep lines use muted styling; if log noise proves excessive during playcheck, collapse consecutive sidesteps in presentation only (engine still emits each event).

## Open Questions

- None blocking. Exact AVD chip color/label is a cosmetic call made in implementation; absolute tier values come out of the D5 sweep.
