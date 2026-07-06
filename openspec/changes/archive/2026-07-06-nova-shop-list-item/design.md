# Design — Nova-style shop list card

## Context

Shop panes (`GearShopPane`, `ToolShopPane` in `src/ui/panes.tsx`) render stock through the shared `ItemRow`: a flat `pso-menu-row` button with kind glyph, name, and trailing price. The approved mockup (session artifact `nova-shop-listitem.html`, kept in the session scratchpad; re-render it if in doubt) replaces this with a Phantasy Star Nova-style card. The artifact demonstrates layout well but under-specifies the finish; this document pins the stylistic details so they survive implementation.

Engine support already exists: weapon attribute bonuses (`WeaponBonuses.native/aBeast/machine/dark/hit`, `items.ts:33-37`), frame/barrier `dfp`/`evp`/`slots`, `EquipRequirements` (`items.ts:112`), and the `canEquip` base-stat check (`character.ts:177`). Curated shop templates strip `requirements` (`content.ts:26`); generated/authentic items keep them.

## Goals / Non-Goals

**Goals:**
- A `ShopListItem` component used by all three shop counters, visually faithful to the mockup *including* the layered-glass finish, slot tab, icon well, and warm-on-cool selection.
- Per-kind chip stat rows and the price + requirement right rail.
- Armour current/max rolls, which requires exposing max DFP/EVP per definition from the PMT data.

**Non-Goals:**
- Bank, inventory, and equipment-candidate lists — they keep `ItemRow` (a follow-up change can adopt the card if it earns its height there).
- Real item render art in the icon well (we scale up the existing vector glyph system; painted thumbnails are a separate effort).
- Any combat/simulation behavior; attributes remain display-only as today.

## Decisions

### D1 — Component and styling location
New `src/ui/components/shop-list-item.tsx` with a co-located `shop-list-item.module.css`, following the existing `panel.tsx`/`panel.module.css` precedent rather than growing `styles.css`. Shared theme tokens stay in `:root` in `styles.css`; the module consumes them. New tokens added to the palette (they are theme vocabulary, not component detail): chip hues (`--attr-native #58c048`, `--attr-abeast #ff8a3c`, `--attr-machine #58a8ff`, `--attr-dark #9a68e8`, `--attr-hit #f0b83c`, `--stat-evp #38b8a0`, `--stat-slot #8aa4b4`) and card glass (`--card-hi rgba(16,40,68,.85)`, `--card-lo rgba(5,14,26,.92)`).

### D2 — The finish, transcribed (this is the contract, not a suggestion)
These recipes come from the approved mockup and are the "higher stylistic touches" the change exists to deliver:

- **Card glass**: `border: 1px solid rgba(191,234,246,.38)` (the bright hairline), `border-radius: 10px`, fill `linear-gradient(180deg, var(--card-hi) 0%, var(--card-lo) 58%)`, and a three-layer shadow stack — `inset 0 0 0 1px rgba(5,12,22,.9)` (the dark inner keyline that makes the hairline read as edge-lit), `inset 0 1px 0 rgba(191,234,246,.18)` (top light), `0 3px 10px rgba(0,0,0,.45)` (lift off the window fill).
- **Hover**: only the cool channel moves — hairline to `rgba(191,234,246,.7)`, top light to `.28`, plus `0 0 12px rgba(70,200,220,.28)` cyan bloom. 140ms ease on border-color/box-shadow/background; `transition: none` under `prefers-reduced-motion`.
- **Selected**: the warm treatment, and the only warm thing in the list — border to `--select-light #ffdf9a`, fill lightened (`rgba(34,52,74,.92) → rgba(14,24,38,.95)`), shadow stack swaps to amber: `inset 0 0 0 1px rgba(248,160,32,.35)`, `inset 0 1px 0 rgba(255,236,190,.35)`, `0 0 0 1px rgba(255,223,154,.55)` (the double outline), `0 0 18px rgba(248,176,64,.45)` glow.
- **Slot tab**: 20px square hanging 13px off the left edge, vertically centered; rest state pewter (`linear-gradient(180deg,#14283c,#0a1626)`, border `rgba(120,170,190,.4)`, numeral `rgba(150,190,205,.55)`); selected state brass (white numeral, `--select-light` border, `linear-gradient(180deg,#3a4a60,#1c2a3e)`, `0 0 8px rgba(248,176,64,.5)` glow). Numerals `tabular-nums`. The tab overhang means the list container needs ~26px left padding.
- **Icon well**: 46px square, `border-radius 7px`, border `rgba(140,190,205,.35)`, fill `radial-gradient(circle at 50% 38%, rgba(60,110,150,.35), transparent 65%)` over `linear-gradient(180deg,#0c1a2c,#050d18)`, `inset 0 0 8px rgba(0,0,0,.7)`. Glyph art gets `filter: drop-shadow(0 0 5px rgba(120,210,235,.5))` so it reads as a lit render.
- **Chips**: 13px-tall rounded squares (`border-radius 3px`, `min-width 14px`, `padding 0 3px`), 8px/800 dark-ink lettering, per-attribute vertical gradient from a +25%-lightness top to the token hue, `0 0 4px rgba(0,0,0,.6)`. Zero-value chips: `filter: saturate(.25) brightness(.55)`, shadow dropped, value text `#4e6a76`.
- **Name row**: rarity colors unchanged (common near-white, uncommon `--accent`, rare `--gold` with its glow), grind suffix in `--attr-native` green, `text-shadow 0 1px 2px rgba(0,0,0,.8)`, single line with ellipsis.
- **Right rail**: price in `--gold` bold `tabular-nums` with the radial meseta coin dot; requirement line 10px/600 beneath — `#e8f4f6` when met, `#55707c` when unmet.

### D3 — Per-kind second row
A discriminated render on `item.kind`:
- `weapon`: N/A/M/D chips always (aligned scanning down the stack; zeros desaturated), HIT chip appended only when `bonuses.hit > 0`. Values from `WeaponBonuses`; absent bonuses render as all-zero.
- `frame`: DFP + EVP as `current/max`, SLOT chip with `unitSlots`.
- `barrier`: DFP + EVP only (no SLOT chip).
- tools (`ToolOffer`): no chips — a muted effect/stock summary line reusing the pane's existing offer copy.

### D4 — Armour max rolls come from a pure engine helper
Add `armorStatCeiling(item): { dfp: number; evp: number } | null` in the engine, computed as the definition's base stat plus its variance range. The ranges are **already shipped** — `item-table.json` preserves frame/barrier "DFP/EVP with ranges" per the item-parameter-data spec — so this is a typed-loader exposure, not a new extraction. Returns `null` when the item has no code/definition with range data — the card then renders the flat value without `/max`. No save-shape change; this reads definitions, not instances, so no `SAVE_VERSION` bump.

**Alternative rejected**: storing max on item instances — bloats saves and requires a version bump for display-only data.

### D5 — Requirement line uses existing gating, hidden when absent
Render from `item.requirements` + the character's base stats, mirroring `canEquip`'s precedence (ATP, then ATA, then MST, then level — show the first unmet requirement, or the primary defined one when all are met). Curated gear has no `requirements` and shows no line; that's correct, not a gap — curated stock equips unconditionally. Label format exactly `Req. ATP 32 (76)`.

### D6 — Selection semantics unchanged
The card remains a `<button role="option">` driving `ui.setDetailId(id)`, `aria-selected` mirrors `detailId`, and focus-visible keeps the 2px accent outline. Slot-tab numbers are display order (1-based index in stock), not hotkeys — hotkeys were floated during exploration and deliberately deferred.

### D7 — Spec deltas, not silent violations
`pso-visual-theme`'s orange-highlight-bar requirement and `item-iconography`'s leading-glyph requirement both get delta specs scoping them to non-shop lists, with the card's selected state and icon well named as the shop-list replacements. The theme spec's token rule is satisfied by D1 (all new colors are tokens).

## Risks / Trade-offs

- [Card is ~2× row height; tool shop stock lists run long] → shop-list containers already scroll (`shop-list` class); verify the tool shop at max stock in a `playcheck` pass and tighten card padding if browsing suffers.
- [Existing vector glyphs may look sparse at 46px in the icon well] → glyphs are per-kind, not per-item; acceptable for this change, and the well's glow treatment carries most of the effect. Flag in the playcheck if it reads as placeholder.
- [PMT variance ranges might not map 1:1 onto our curated armour defs] → `armorStatCeiling` returning `null` degrades gracefully to flat display; curated defs without codes simply skip the `/max`.
- [Layered shadow stacks on every card could jank on low-end machines when the hub scene animates behind] → shadows are static (no animated blur radii); hover/selection transitions touch only border-color/box-shadow at 140ms. Acceptable; verify no scroll jank in playcheck.

## Open Questions

- None blocking. Deferred by decision: slot-tab hotkeys (D6), card treatment for bank/equipment lists (Non-Goals), per-item painted icon art (Non-Goals).
