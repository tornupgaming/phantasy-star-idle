# Delta: battle-scene-view

## MODIFIED Requirements

### Requirement: Event playback with visual feedback
The stage SHALL play newly revealed events at their run timestamps with visual feedback, rather than re-rendering the whole screen on a fixed poll. Floating combat text (damage numbers and the MISS indicator) SHALL render from the committed PSO bitmap glyph atlas with pixel-crisp integer scaling; if the atlas asset is unavailable, floating text SHALL fall back to plain text so combat feedback is never lost.

#### Scenario: Hit feedback
- **WHEN** an attack event that hits is revealed
- **THEN** the target's element SHALL show a brief hit effect and a floating damage number composed of bitmap glyphs from the atlas, and the target's health bar SHALL update to the post-hit value; critical hits SHALL be visually distinguished (larger scale and gold tint)

#### Scenario: Miss feedback
- **WHEN** an attack event that misses is revealed
- **THEN** the stage SHALL show a red "MISS" indicator composed of bitmap glyphs from the atlas on the target, without changing any health bar

#### Scenario: Atlas unavailable fallback
- **WHEN** the glyph atlas image fails to load
- **THEN** floating damage numbers and the MISS indicator SHALL render as plain text with the same colors and animation

#### Scenario: Log and ticker miss styling unchanged
- **WHEN** a miss event is written to the battle log or ticker
- **THEN** those lines SHALL keep their existing muted styling (only the floating MISS indicator is red)

#### Scenario: Death feedback
- **WHEN** a kill event is revealed
- **THEN** the corresponding enemy SHALL be visually marked defeated (e.g., faded out) and SHALL no longer present a live health bar

#### Scenario: Heal and revive feedback
- **WHEN** a heal or revive event is revealed
- **THEN** the player health bar SHALL update to the post-event value with a visual cue distinct from taking damage

#### Scenario: Room transition
- **WHEN** a room event is revealed
- **THEN** the stage SHALL clear the previous room's enemies and present the new room's roster

#### Scenario: Animations survive ongoing updates
- **WHEN** multiple events are revealed while an effect is animating
- **THEN** in-flight visual effects SHALL NOT be destroyed by unrelated updates (the stage DOM persists and is updated incrementally)

#### Scenario: Background progress is not lost
- **WHEN** the tab is unfocused or rendering is throttled and later resumes
- **THEN** the stage SHALL catch up to the current game time immediately, without replaying the missed interval in real time
