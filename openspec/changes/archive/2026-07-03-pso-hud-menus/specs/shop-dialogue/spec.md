# shop-dialogue — delta

## ADDED Requirements

### Requirement: Dialogue window with pane greetings
The hub SHALL display a PSO-style dialogue window anchored to the bottom of the HUD. On entering a pane, the dialogue window SHALL show a greeting line in that location's voice (e.g. "Welcome to the Weapon Shop! Looking for something with an edge?"). A greeting SHALL fire once per pane visit: re-renders within the same pane SHALL NOT re-trigger it. Greeting lines SHALL rotate through a per-pane pool deterministically (cycling index, no RNG requirement).

#### Scenario: Greeting on pane entry
- **WHEN** the player switches to a shop, bank, guild, or equipment pane
- **THEN** the dialogue window SHALL show a greeting line for that pane

#### Scenario: No re-greeting on re-render
- **WHEN** the player performs an action that re-renders the current pane
- **THEN** the greeting SHALL NOT replay; the dialogue line SHALL only change in response to a reaction event

### Requirement: Typewriter reveal with instant-complete
Dialogue lines SHALL appear with a typewriter-style progressive reveal. Any click on the dialogue window or key press SHALL complete the current line instantly. A new line SHALL cancel any in-progress reveal before starting.

#### Scenario: Skip the reveal
- **WHEN** a line is mid-reveal and the player clicks the dialogue window or presses a key
- **THEN** the full line SHALL be shown immediately

### Requirement: Reactive shopkeeper lines
Action outcomes on shop, bank, guild, and equipment panes SHALL update the dialogue line with a contextual reaction: successful purchase, successful sale, insufficient meseta, sold-out stock, equip, and quest acceptance SHALL each have at least one line. Failure reactions SHALL convey the reason in-voice (e.g. "You're a little short on meseta, hunter."), replacing the bare error notice for these flows.

#### Scenario: Purchase reaction
- **WHEN** the player buys an item with sufficient meseta
- **THEN** the dialogue window SHALL show a purchase reaction line

#### Scenario: Insufficient funds in-voice
- **WHEN** the player attempts a purchase without enough meseta
- **THEN** the purchase SHALL fail and the dialogue window SHALL show an insufficient-meseta line stating the problem

### Requirement: Item flavor text
Item detail views in shops, the bank, and the equipment pane SHALL lead with a one-line flavor description of the highlighted item, resolved from a hand-written table keyed by item name with item-kind fallbacks, so every item resolves to some line. The compact stat string SHALL remain, presented as secondary small print beneath the flavor line.

#### Scenario: Flavor line for any item
- **WHEN** the player highlights any item in a shop, bank, or equipment list
- **THEN** the detail view SHALL show a flavor line for it (specific or kind-level fallback) above the stat string
