# Design — frame-data attack speeds

## Context

`pacing.ts` drives the character's three-hit combo-burst rhythm from five hand-authored archetypes keyed by `WeaponType`, with every authentic `WeaponKind` (0..18) mapped onto an archetype by `WEAPON_KIND_ARCHETYPE` — a table the file itself documents as a temporary seam awaiting the pioneer2.net frame data. The wiki page (`Game_mechanics/Frame_data`, raw wikitext ~60KB, archived) measures PSO:BB at 30 fps and records, per animation rig and weapon kind, Normal and Heavy frame counts for combo steps 1–3 in two flavors: **Combo** (attack chains into the next step) and **Full** (the combo ends here, including recovery tail).

Measured coverage is asymmetric:

- **+40% speed ("V101") tables are complete**: Male covers all 19 weapon kinds; Female, HUcaseal, RAmarl, FOmar, FOmarl are sparse overrides (anything absent = same as Male, the wiki's stated convention).
- **0% speed tables are fragmentary**: only saber, sword, dagger, partisan, handgun, mechgun (Male, plus fragments for Female/HUcaseal). 13 of 19 kinds have no 0% measurement at all.
- The 0%→40% speedup is **not** a uniform ÷1.4 — it varies by combo position. Measured 0%/40% ratios across all pairs: full1 1.08–1.15 (median 1.12), combo1 1.14–1.35 (median 1.23), full2 1.10–1.20 (median 1.13), combo2 1.19–1.40 (median 1.27), full3 1.08–1.32 (median 1.26).

Attack-speed units are canonical in newserv's item parameter table (stat 19 = attack-speed %): General/Battle 5, Devil/Battle 10, God/Battle 20, Heavenly/Battle 40. V101 uses a different, client-hardcoded stat (8/15/modifier 1) but is community-documented as +40% — the wiki's fast tables are literally labeled "V101". All five already exist in `src/engine/data/item-table.json` under `units` with their `stat`/`statAmount` fields intact.

Constraints: engine purity and seeded-RNG determinism (same `(runId, seed)` → identical battle log), ms-based game time, integer arithmetic for replay stability, `SAVE_VERSION` discipline.

## Goals / Non-Goals

**Goals:**
- Authentic per-rig × weapon-kind × tier × combo-step attack timing, exact at both measured anchors (0% and +40%).
- Functional attack-speed units with highest-equipped-wins semantics.
- Heavy (and Special) attacks cost their real, longer frame durations.
- Reproducible extraction pipeline from archived wikitext, mirroring `extract-item-table.mjs`.
- Integer game-ms end to end; deterministic replays.

**Non-Goals:**
- Technique casting speed tables (techs are deferred).
- Exotic per-weapon animations (L&K38 Combat, Master Raven, Last Swan) — they use their kind's standard timing.
- Enemy attack cadence (not covered by the frame data; stays hand-authored).
- Modeling V101's real secondary effects (its hardcoded stat) beyond the +40% speed.
- Exact emulation of intermediate speed boosts (5/10/20% were never measured by anyone; we interpolate).

## Decisions

### D1 — Two anchor tables + per-cell lerp (not a single table + multiplier)

Store both measured anchors as ms consts. Effective step duration at boost `p` (0–40):

```
ms(p) = ms0 - round((ms0 - ms40) * p / 40)
```

Integer inputs, one rounding, exact at p=0 and p=40. Alternatives rejected: a single 0% table with `ms/(1+p)` makes V101 ~29% faster where the game gives ~10–27% depending on position (the chase item would overperform, and the complete measured 40% data would be discarded); anchoring only at 40% with inverse ratios is the same math with worse provenance.

### D2 — Reconstruct missing 0% cells from per-position median ratios

For kinds/rigs with no 0% measurement, `frames0 = round(frames40 × medianRatio[position])` using the medians above, computed by the extraction script from the kinds measured at both speeds. Reconstruction happens **in the extraction script only**, and emitted cells carry a `reconstructed: true` marker so future wiki measurements can replace them. This is grounded in measured data (the ratios are tightly clustered per position) rather than invented numbers.

### D3 — Rig resolution and sparse fallback

`rigForClass(classId)`: FOmar/FOmarl/HUcaseal/RAmarl → their named rigs; otherwise gender → male/female rig. Lookup order: exact rig table → male table (the wiki's own fallback rule). Fallback is structural in the accessor, not baked into the data — the JSON stays a faithful transcription of the wiki.

### D4 — Data pipeline and shapes

- The raw wikitext is checked into the repo (`scripts/data/frame-data.wiki`) so extraction is reproducible offline; the wiki page is a living community document and we want a pinned snapshot with provenance noted in the file header.
- `scripts/extract-frame-data.mjs` parses the wikitable markup for tables 1–9 (weapon frame data only) and emits `src/engine/data/frame-data.json`: `{rig: {kind: {tier: {combo1, full1, combo2, full2, full3}}}}` per anchor, frame counts, with `reconstructed` markers. npm script `extract:frame-data`.
- `src/engine/data/frame-data.ts` converts frames→ms **once at module load** into consts (`Math.round(frames * 1000 / 30)`) and exposes the typed accessor `attackStepMs(rig, weaponKind, attackType, step, isFinal, speedBoost)`. Special maps to Heavy timing here.

### D5 — Pacing API change

`pacing.ts` drops `WEAPON_COMBO_STEP_MS`, `WEAPON_KIND_ARCHETYPE`, `archetypeForWeaponKind`, and `BAREHANDED_COMBO_STEP_MS`'s flat model. New:

```
nextComboDelay(rig, weaponKind | null, attackType, stepJustPerformed, comboReset) =
  attackStepMs(..., isFinal = comboReset || step === COMBO_LENGTH - 1, speedBoost)
  + (burstOver ? COMBO_RECOVERY_MS_reposition : 0)
```

- Chained steps bill their **Combo** frames; the burst-ending step bills its **Full** frames (the animation's real recovery). A kill mid-combo bills that step's Full frames (the swing completes; the combo just doesn't continue).
- The repositioning pause is retained but retuned: Full frames already contain animation recovery, so the current 1000ms would double-count. It becomes a smaller movement-only knob (initial value decided in the balance pass), still the idle game's pacing valve.
- Barehanded uses the **fist** kind (weapon kind 0) — it has authentic data; the flat barehanded const disappears.
- `WeaponType` (the 5-archetype union) stays for now purely as an items/display concept if still referenced; pacing stops consuming it. If nothing else consumes it, it is removed with its `weaponType` field wiring in a cleanup task.

### D6 — Speed-unit derivation

Equipment derivation exposes `attackSpeedBoost = max(statAmount of equipped units with stat 19, V101 → 40, else 0)` — highest wins, no stacking (user decision). The run snapshots this at dispatch alongside the rest of the derived stats, so an equip change mid-run doesn't perturb a deterministic replay. V101's special-cased stat is normalized to boost 40 in the item loader with a comment citing the client-hardcoded behavior.

### D7 — Heavy costs frames → attack-pattern balance check

With Heavy ~15–30% slower per step, the default N/H patterns need re-evaluation (today Heavy is a free 1.89× damage). The change includes a DPS sanity pass over the shipped patterns (a test comparing expected sustained DPS of NNN vs NHH vs HHH against a reference target dummy) and retunes pattern defaults if an option strictly dominates.

### D8 — No save version bump (resolved during implementation)

The run input already snapshots the **full Character** (equipment included), and rig/kind/boost are derived from that snapshot inside `simulateRun` — so the dispatch-time-capture requirement holds with no new persisted field and no `SAVE_VERSION` bump. A separate `speedBoost` snapshot field would not buy replay stability across data retunes anyway (the timing tables themselves would need snapshotting), so it was dropped. Old saves' weapons lack `weaponKind`; they fall back through their persisted `weaponType` via `KIND_FOR_ARCHETYPE` (items.ts), which also keeps `WeaponType` alive as a display label — the D5 open question about removing it is resolved as "keep".

### D9 — Enemy cadence rescale (implementation finding)

Authentic character timings are ~30–45% slower per burst than the old archetype table at 0% boost, which flipped the survival balance (well-geared characters died where they previously completed). Enemy attack intervals were scaled ×~1.45 (grunt 1500→2200, beast 1100→1600, flyer 1300→1900, boss 1000→1450) to preserve the pre-existing exchange ratio of ~2.4 character swings per grunt attack. Runs are correspondingly longer in game-time; `GAME_SPEED` remains the global idle-feel knob if that needs compressing later.

## Risks / Trade-offs

- [Reconstructed 0% cells are approximations] → confined to the extraction script, marked in the JSON, per-position medians are tightly clustered (spread ≤ ±0.13); replaceable if the community measures more.
- [Intermediate boosts (5/10/20%) are interpolations] → nobody has measured them; lerp is exact at both endpoints and monotonic, which is all gameplay needs.
- [Run pacing shifts globally, invalidating tuned run durations] → sanity check: Male saber NNN ≈ 1.8s/burst vs today's 1.9s — same ballpark; the balance pass (D7) plus the repositioning knob absorb drift; expected-timing test fixtures are regenerated deliberately, not silently.
- [Wikitable parsing is brittle] → we parse a pinned snapshot, not the live page; extraction tests assert known cell values (e.g. Male saber N1 full = 29 @40%, 32 @0%).
- [V101 = 40% is community lore, not a table value] → documented at the normalization site; worst case it's a one-line retune.
- [Determinism regression via float lerp] → integer fixed-point formula (D1), covered by replay tests.
- [Multi-hit animations under-credited] → PSO's dagger/mechgun/twin-sword swings land multiple hits per animation; the engine resolves one hit per swing, so those kinds now pay their authentic slow frames without their authentic multi-hit damage. Acceptable for now (they were equally single-hit before); a future multi-hit port would restore their DPS identity.

## Open Questions

All resolved during implementation:

- Repositioning pause → 400ms (animation recovery now lives in the Full frame durations); balance restored via the D9 enemy-cadence rescale rather than further pause tuning.
- `WeaponType` → kept as a display label and as the timing fallback for weapons without a `weaponKind` (curated gear, old saves); see D8.
