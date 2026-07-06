# Balance sweep summary (task 5.1 / 5.2)

Seeded sweeps: 200 seeds per cell, ironSaber (melee) vs scoutRifle (ranged),
forest at level 5 and caves at level 12, normal difficulty. Global avoidance
multipliers ×0.75 / ×1.0 / ×1.25 / ×1.5 over the authored tiers, plus a heal
threshold sweep (0.65 / 0.5 / 0.4) at ×1.0.

## Outcome

- **Avoidance scale ships as authored (×1.0)** — melee 20 (partisan 25),
  mechgun/shot 35, slicer/card 45, handgun/launcher 50, rifle 55. Forest is
  already at target at every scale tested (0% eject, ~7 mates melee / ~3.4
  ranged, no moon burn); raising the scale only trims already-modest mate use.
- **`DEFAULT_SURVIVAL.healThresholdFraction` lowered 0.65 → 0.5** (not the
  sweep's 0.4). The sweep — run on level-appropriate geared characters —
  showed 0.4 keeps eject rates flat while roughly halving caves mate burn
  (melee 99→43, ranged 81→26). But 0.4 breaks the archetype pacing guarantee
  (`tests/e2e.test.ts`): a fresh level-1 HUmar with starter gear went from
  reliably clearing forest normal to 0/5 — small HP pools leave lethal windows
  below a 40% trigger. 0.5, the sweep's middle step, keeps every suite
  guarantee green while still cutting mate use.
- The ranged-vs-melee axis works as designed in forest: ranged burns roughly
  half the consumables at equal (zero) death rate.

## Key sweep rows (×1.0 scale)

| area | weapon | eject% | mates | moons | endTime(ms) |
|---|---|---|---|---|---|
| forest | ironSaber | 0.0 | 6.89 | 0.00 | 149389 |
| forest | scoutRifle | 0.0 | 3.42 | 0.00 | 138788 |
| caves | ironSaber | 36.0 | 103.7 | 2.92 | 499501 |
| caves | scoutRifle | 29.5 | 75.4 | 2.38 | 587428 |

## Follow-ups surfaced (out of scope for this change)

1. **Caves ~30% eject rate is not an avoidance problem.** It is flat across
   avoidance scale (×0.75–×1.5), character level (12–25), and heal threshold
   (0.4–0.65); ejects are cumulative/burst damage deaths (median hit ~22,
   max ~39 vs ~48 HP at level 12), never 0-damage stalls. Needs its own
   investigation: enemy spread/clustering, HP curve pacing, or engaged-enemy
   count.
2. **Melee is not the clear-speed leader.** In forest, ironSaber (~149s) is
   slower than scoutRifle (~137–139s) at every scale; avoidance cannot affect
   this (it never touches outgoing DPS). Likely a frame-data/attack-cadence
   gap — melee is supposed to pay its low avoidance with faster clears
   (design D5 anti-dominance target). Currently ranged wins both axes in
   forest, mildly: separate balance pass warranted.
