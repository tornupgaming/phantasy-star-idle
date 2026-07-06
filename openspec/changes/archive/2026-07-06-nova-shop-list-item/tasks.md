# Tasks — nova-shop-list-item

## 1. Engine: armour stat ceilings

- [x] 1.1 Add the `armorStatCeiling` pure helper to the typed item-table loader, resolving frame/barrier codes to base+range DFP/EVP ceilings and returning null when no code or range data exists (design D4)
- [x] 1.2 Unit-test the helper: known dataset entry (e.g. Frame `010100`) returns base+range; codeless curated armour returns null; no `Math.random`, no state mutation

## 2. Theme tokens

- [x] 2.1 Add the new palette tokens to `:root` in `src/ui/styles.css`: chip hues (`--attr-native`, `--attr-abeast`, `--attr-machine`, `--attr-dark`, `--attr-hit`, `--stat-evp`, `--stat-slot`) and card glass (`--card-hi`, `--card-lo`) per design D1

## 3. ShopListItem component

- [x] 3.1 Create `src/ui/components/shop-list-item.tsx` + `shop-list-item.module.css` with the card skeleton: slot tab, icon well (reusing the kind-glyph sprite at 46px), name row with rarity coloring and green grind suffix, per-kind second row, right rail; card is a `<button role="option">` driving `detailId` with `aria-selected`
- [x] 3.2 Implement the layered glass finish exactly per design D2: hairline-over-keyline border stack, top-lit gradient fill, drop shadow, recessed icon well with radial top glow and glyph drop-shadow
- [x] 3.3 Implement interaction states per design D2: cool-only hover (brightened hairline + cyan bloom), warm selected state (amber double outline, glow, lightened fill, brass slot tab), 140ms transitions disabled under `prefers-reduced-motion`, visible focus outline
- [x] 3.4 Implement chip stat rows per design D3: weapon N/A/M/D always with desaturated zeros and conditional gold HIT chip; frame DFP/EVP current/max (flat when ceiling is null) + SLOT chip; barrier without SLOT; tool offers get the effect/stock summary line
- [x] 3.5 Implement the requirement line per design D5: `Req. <STAT> <needed> (<current>)` from `item.requirements` vs base stats mirroring `canEquip` precedence, white met / grey unmet, absent when the item has no requirements

## 4. Shop pane integration

- [x] 4.1 Swap `GearShopPane` (weapon + armour counters) from `ItemRow` to `ShopListItem`, adding the slot-tab left padding to the shop list container and keeping buy flow and empty-stock fallbacks intact
- [x] 4.2 Swap `ToolShopPane` offers to `ShopListItem` with the tool summary row, preserving stacking/stock counts and the grinder offer
- [x] 4.3 Confirm non-shop lists (bank, inventory, equipment candidates) still render flat `ItemRow`s with leading glyphs and the orange highlight bar

## 5. Verification

- [x] 5.1 Run the test suite (`vitest run`), including the RNG-purity guard and the new ceiling tests
- [x] 5.2 `playcheck` pass: browse all three shop counters — verify card finish (glass layers, slot tabs, icon wells), hover vs selected states, chip rows per kind, requirement line met/unmet coloring, no clipped tab overhang, tool shop scroll behavior at max stock, and no scroll jank over the animated hub scene; Read the key screenshots
- [x] 5.3 Update the delta specs' scenarios against what shipped and run `openspec validate --change "nova-shop-list-item"`
