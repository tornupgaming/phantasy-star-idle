# pso-visual-theme Specification (delta)

## MODIFIED Requirements

### Requirement: PSO menu and control styling
Interactive lists outside shop stock lists SHALL use PSO-style menu rows with an orange highlight bar on hover/selection; when the highlight moves between rows of the same menu, the bar SHALL animate its movement with a brief slide (respecting `prefers-reduced-motion`). Shop stock lists (weapon counter, armour counter, tool shop) SHALL instead use the Nova-style card treatment defined by the shop-list-card capability, whose amber selected-state glow serves as the selection highlight for those lists. Each screen's primary action SHALL be visually distinguished (hexagonal or otherwise PSO-accented treatment); secondary actions SHALL use flat rectangular controls. HP bars SHALL keep their existing class-name contract (widths set by the battle stage) while restyled to the PSO green-on-dark-bezel look.

#### Scenario: Menu row highlight

- **WHEN** the player hovers or selects a menu/list row outside a shop stock list
- **THEN** the row SHALL show the orange PSO selection bar

#### Scenario: Highlight slides between rows

- **WHEN** the highlight moves from one row to an adjacent row of a non-shop menu and reduced motion is not requested
- **THEN** the orange bar SHALL animate the transition rather than jumping

#### Scenario: Shop lists select via the card treatment

- **WHEN** the player hovers or selects an offer in a shop stock list
- **THEN** the Nova card's cool hover / warm selected treatment SHALL apply and no orange highlight bar SHALL render

#### Scenario: HP bar contract preserved

- **WHEN** the battle stage updates an HP bar's width during a run
- **THEN** the restyled bar SHALL reflect the update using the same element/class structure as before the theme change
