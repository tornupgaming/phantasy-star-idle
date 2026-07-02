## ADDED Requirements

### Requirement: Equipment stat preview
The engine SHALL provide a pure stat-preview computation returning a character's effective stats as-if a candidate item were equipped in a given slot (or as-if the slot were emptied), without mutating the character or their equipment. For units, the preview SHALL model adding the candidate unit when unit capacity remains. The preview SHALL agree with the effective stats the character would actually have after performing the corresponding equip or unequip.

#### Scenario: Preview a weapon swap
- **WHEN** a preview is computed for a weapon candidate on a character with a weapon equipped
- **THEN** the returned stats SHALL equal the effective stats the character would have with the candidate equipped in place of the current weapon, and the character's actual equipment and stats SHALL be unchanged

#### Scenario: Preview removing an item
- **WHEN** a preview is computed for emptying an occupied slot
- **THEN** the returned stats SHALL equal the effective stats the character would have with that slot empty

#### Scenario: Preview matches committed equip
- **WHEN** a previewed candidate is subsequently equipped
- **THEN** the character's effective stats SHALL equal the previewed stats
