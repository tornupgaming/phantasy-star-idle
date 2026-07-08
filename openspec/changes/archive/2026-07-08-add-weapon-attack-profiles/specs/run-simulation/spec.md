# run-simulation Specification (delta)

## ADDED Requirements

### Requirement: Weapon attack profile fan-out
A character swing SHALL fan out according to the equipped weapon's attack profile: it SHALL strike up to the profile's maximum-target count of living enemies, selected in roster order starting from the first living enemy, and SHALL perform the profile's per-step hit count against each struck target. Striking a queued (not yet engaged) enemy SHALL NOT change engagement. Each hit SHALL emit its own attack log event using the existing attack event payload (actor, target index, hit, critical, damage, target HP after). A target killed mid-swing SHALL receive no further hits from that swing, its kill handling (XP, drop, engagement advance) SHALL run immediately, and remaining hits SHALL NOT retarget within the swing. The swing SHALL bill exactly one frame-data step duration regardless of hit and target counts, and the combo SHALL advance once per swing.

#### Scenario: Multi-hit swing emits one attack event per hit
- **WHEN** a character with daggers (2 hits per step) performs a combo step against an enemy
- **THEN** the battle log SHALL contain two attack events for that swing, each with its own hit/critical/damage outcome and the target's HP after that hit

#### Scenario: Sweep strikes multiple living enemies in roster order
- **WHEN** a character with a sword (max 4 targets) swings in a room with three living enemies
- **THEN** the swing SHALL resolve one hit against each of the three enemies in roster order, and each hit SHALL be logged with its target's roster index

#### Scenario: Sweep does not engage queued enemies
- **WHEN** a sweep damages a living enemy that has not yet been engaged
- **THEN** that enemy SHALL remain queued (its attack clock SHALL NOT start) until engagement advances through the existing kill-replacement rule

#### Scenario: Target killed mid-swing receives no overkill hits
- **WHEN** the first hit of a multi-hit step reduces its target to 0 HP
- **THEN** the kill event (XP, drop, engagement advance) SHALL occur immediately, the remaining hits of that step SHALL NOT strike the dead target, and they SHALL NOT be redirected to another enemy

#### Scenario: Combo resets only when the primary target dies
- **WHEN** a sweep kills a secondary target but the primary target (the first target of the swing) survives
- **THEN** the combo SHALL continue to the next step; **AND WHEN** the primary target dies the combo SHALL reset and the swing SHALL bill its Full duration plus the repositioning pause

#### Scenario: Fan-out does not change swing timing
- **WHEN** a mechgun (3 hits per step) and a saber (1 hit per step) each perform a first-step Normal attack with the same rig and speed boost
- **THEN** each swing SHALL bill only its own weapon kind's frame-data step duration, independent of the number of hits performed
