# Design: apply-bb-stat-transform

## Context

`src/engine/classes.ts` is a verbatim generated mirror of newserv's `system/tables/level-table-v4.json` (verified field-by-field: bases, maxes, all delta arrays, XP thresholds). The engine derives stats in `statsAtLevel` (`src/engine/progression.ts`) by summing deltas onto base — exactly what newserv's `advance_to_level` does server-side.

The discrepancy: the real BB **client** applies a further transform (in the executable, absent from newserv, which never needs it) before stats are shown or used. Empirically derived by fitting our table against Ephinea wiki growth tables (HUmar, RAcast, RAmar, FOnewearl at L1/L5/L10/L200 — exact at every point) and corroborated by the pioneer2.net "Default Player Level Tables" thread:

| Stat | Transform |
|---|---|
| ATP | table + role bonus: hunter +10, ranger +5, force +3 (also on max cap: 1387+10 = 1397 ✓) |
| HP | `floor(roleMult × (tableHP + level − 1))`; hunter 2.0, ranger 1.85, force 1.45 |
| ATA | table base ATA is **tenths**; add per-class constant (tenths): `constant + baseAta + Σ deltas`. HUmar 650+30 → 68.0 ✓; cap 650+1355 → 200.5 → 200 ✓ |
| TP | hunter/ranger `MST + level − 1`; force `floor((MST + level − 1) × 1.5)`; android 0 |
| DFP/EVP/MST/LCK | verbatim, no transform |

Known ATA constants: HUmar 650, RAmar 760, RAcast 710, FOmar 620, FOnewearl 600. The other seven (HUnewearl, HUcast, HUcaseal, RAmarl, RAcaseal, FOmarl, FOnewm) must be derived from Ephinea's per-class tables: `constant = wikiL1AtaTenths − tableBaseAta`.

## Goals / Non-Goals

**Goals:**
- Derived character stats (base, per-level, and displayed caps) match authentic BB client values for all 12 classes.
- Model TP as a derived stat.
- Keep `classes.ts` table data byte-comparable to newserv's JSON.
- Determinism preserved: same (classId, level) → same stats; same (runId, seed) → same battle log under the new stats.

**Non-Goals:**
- Techniques / TP consumption mechanics (TP is derived and displayed-capable, but nothing spends it yet).
- Materials / mag stat contributions.
- Rebalancing enemies or pacing (a follow-up balance pass is expected, not part of this change).
- Regenerating or altering the level-table data itself.

## Decisions

1. **Transform lives in `progression.ts`, not baked into the table.** `classes.ts` stays a verbatim newserv mirror so it can be re-verified/regenerated mechanically. The HP multiplier + floor cannot be represented as integer per-level deltas anyway. Alternative rejected: pre-computing 200-entry effective-stat arrays per class (opaque, un-auditable, larger).

2. **New authored constants live in `classes.ts` alongside the generated data**, clearly separated from the generated block: `ROLE_ATP_BONUS`, `ROLE_HP_MULT` (per `ClassRole`), and `ataConstantTenths` per class (or a parallel record keyed by class id). Rationale: co-located with the class defs that consume them; the generation header must state they are authored, not generated.

3. **HP multiplier as integer math.** Multipliers are ×2, ×1.85, ×1.45 with floor. To avoid float drift in the pure engine, compute in hundredths: `Math.floor(multHundredths * (tableHp + level - 1) / 100)` with multHundredths ∈ {200, 185, 145}. Exactly reproduces `floor(1.85 × x)` for integer x.

4. **ATA fix is a reinterpretation, not a data change.** Current code does `base.ata * 10` (treats 30 as 30.0); correct is `ataConstant + base.ata` in tenths. Display remains `floor(tenths / 10)`. The `classes.ts` header comment is corrected.

5. **Caps transformed at read time.** Displayed/effective caps: ATP cap + role bonus; ATA cap + class constant; HP cap `floor(mult × (capHp + 199))` (cap semantics = maximum attainable at level 200). DFP/EVP/MST caps unchanged. Clamping order: clamp raw table accumulation to raw caps first, then transform — equivalent to transforming both sides since transforms are monotonic; pick one and test it against Ephinea's natural-vs-cap pairs (e.g., HUmar ATA 174.8 natural / 200 cap).

6. **TP on `Stats`.** Add `tp` to `makeStats`/`Stats`. Androids identified via `CLASS_EQUIP_MASK & EQUIP_ATTR.android`. TP is derived only — nothing persists it, so no `SAVE_VERSION` bump (verify: `save.ts` persists xp/level/equipment, not derived stats).

7. **Verification fixture from Ephinea data.** A test fixture (checked-in JSON of Ephinea wiki table rows for all 12 classes at levels 1, 5, 10, 50, 100, 150, 200) asserts `statsAtLevel` output equals published values for HP, ATP, DFP, MST, ATA (to 0.1), EVP, and TP. This is the acceptance gate for the seven newly derived ATA constants.

## Risks / Trade-offs

- [Ephinea tables could deviate from vanilla BB for some class] → Cross-check at least one class against a second source (e.g., schtserv/pso-world charts); the pioneer2.net thread values corroborate the mechanism and several constants.
- [Old (runId, seed) replays diverge — recorded runs/reports no longer reproduce] → Accept; note in changelog. Saves are unaffected (stats derived). No `SAVE_VERSION` bump unless verification of decision 6 finds persisted derived state.
- [Game becomes too easy: enemy stats were authentic but pacing may have been tuned around weak players] → Run a `balance-sim` sweep (clear rates by area/level) after implementation; file a follow-up balance change if needed rather than tuning inside this one.
- [Clamp-order ambiguity near caps] → Fixture includes level-200 rows where natural values approach caps; test pins the chosen order.

## Open Questions

- Exact ATA constants for the seven unverified classes (resolved during implementation from Ephinea tables; the fixture makes wrong guesses fail loudly).
- Whether the UI should surface TP now (default: expose in stat preview only if trivial; otherwise defer).
