# Nova-style shop list card

## Why

Shop browsing currently renders one flat `pso-menu-row` per item — name and price only — so judging an offer means opening the detail pane item by item. The approved Phantasy Star Nova-style card mockup (session artifact `nova-shop-listitem.html`) showed that a two-line card surfaces attributes, armour rolls, and equip requirements at a glance while looking dramatically better in the shop scene.

## What Changes

- Replace the flat `pso-menu-row` in the shop panes (weapon counter, armour counter, tool shop) with a Nova-style `ShopListItem` card component.
- The card is not just a relayout — the stylistic treatment is the point and must survive implementation:
  - **Layered glass card**: bright outer hairline over a dark inner keyline, top-light vertical gradient fill, soft drop shadow.
  - **Hanging slot tab**: numbered square overlapping the card's left edge; dim pewter at rest, brass-lit (white numeral, warm border, glow) when selected.
  - **Recessed icon well**: square thumbnail with inner shadow and a faint top radial glow so item art reads as a lit render.
  - **Warm-on-cool selection**: hover brightens only the cyan edge; the selected card alone gets the amber double-outline and outer glow (PSO's warm select against the cool ground), with the existing reduced-motion respect.
- Per-kind second row using tiny rounded colored stat chips:
  - Weapons: `N` (green) / `A` (orange) / `M` (blue) / `D` (purple) attribute percentages, plus a gold `HIT` chip only when hit > 0. Zero attributes keep their chip but desaturate.
  - Armour (frames/barriers): blue `DFP` and teal `EVP` chips showing current/max rolls, plus a slate `SLOT` chip on frames.
  - Tools: a compact effect/stock line in place of chips.
- Rarity-colored names (existing colors) with the grind rendered in green (`+3`).
- Right rail: meseta price with an equip-requirement line beneath it — `Req. ATP 32 (76)` — white when the character meets it, grey when not; omitted for items without requirements.
- **BREAKING (visual/spec only)**: shop lists no longer show the orange PSO highlight bar or the leading kind glyph; the card's selection treatment and icon well take over those jobs. Bank, inventory, and equipment lists keep the existing flat rows.

## Capabilities

### New Capabilities

- `shop-list-card`: the Nova-style shop list item — card anatomy (slot tab, icon well, two-line body, right rail), per-kind chip stat rows, requirement line, and the hover/selected visual states.

### Modified Capabilities

- `pso-visual-theme`: the orange highlight-bar menu-row requirement is scoped to non-shop lists; shop lists select via the Nova card's amber glow treatment instead.
- `item-iconography`: the leading kind-glyph requirement is scoped to non-shop rows; in shop lists the icon well carries kind identification.
- `item-parameter-data`: expose armour DFP/EVP maximum rolls (base + variance range from the PMT data, via newserv) so the card can render current/max.

## Impact

- `src/ui/panes.tsx` — `ItemRow` replaced/bypassed in `GearShopPane` and `ToolShopPane`; a new `ShopListItem` component lands in `src/ui/components/`.
- `src/ui/styles.css` (or a component-scoped module beside `panel.module.css`) — new card styles built from the existing token palette; new tokens only where the palette lacks a value (chip hues, card glass).
- `src/engine/items.ts` / item parameter data — a pure helper for armour max rolls; equip-requirement display reuses the existing `canEquip` logic (`src/engine/character.ts:177`). No save-shape change, no `SAVE_VERSION` bump.
- No engine simulation or persistence behavior changes; this is presentation plus one read-only data exposure.
