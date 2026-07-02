## 1. Engine — shop split (design D3, D4)

- [x] 1.1 Split `SHOP_POOL` in `src/engine/shop.ts` into weapon and armour pools (armour = frames + barriers + units; each kind has ≥2 band-0 templates), add `ShopKind`, and make `generateGearStock(characterId, kind, band, restock)` seed the RNG per kind
- [x] 1.2 Change `RosterEntry.shop` in `src/engine/game.ts` to `{ weapon: ShopStock; armour: ShopStock }`; update `shopStock(kind)`, `buyGearFromShop(kind, offerId)`, and roster-entry creation
- [x] 1.3 Bump `SAVE_VERSION` to 3 in `src/engine/save.ts` with a v2→v3 migration that regenerates both stocks per roster entry (current band, restock 0)
- [x] 1.4 Tests: stock segregation by kind, per-kind determinism and independent streams, band restock regenerates both stocks, v2 save fixture migrates and loads

## 2. Engine — stat preview (design D5)

- [x] 2.1 Add pure `previewStats(character, slot, item | null)` to `src/engine/character.ts` (shallow-cloned equipment; unit add gated by capacity; no mutation)
- [x] 2.2 Tests: preview equals post-equip `effectiveStats` for weapon/frame/barrier/unit and for removal; character untouched by preview

## 3. UI — hub shell (design D1, D2, D7)

- [x] 3.1 Collapse `shop-gear`/`shop-tool`/`bank` screens in `src/ui/views.ts` into the `hub` screen with UI-local `pane` state (`guild | weapon-shop | armour-shop | tool-shop | equipment | bank`), defaulting to `guild` on every hub entry
- [x] 3.2 Render the hub shell: `statusBar()` (name, class, section ID, Lv, Total Exp, To Next Lv / max-level, meseta, grinders) + sidebar (seven entries, active highlight, Change Character exits to select) + detail region
- [x] 3.3 Sidebar/status-bar/pane layout styles in `src/ui/styles.css` reusing existing `pso-*` primitives; select/create/run keep their existing headers
- [x] 3.4 Port Hunters Guild pane (quest counter, loot filter, supply, accept quest) and anchor the post-run report dialog to it

## 4. UI — shop and bank panes

- [x] 4.1 Weapon Shop and Armour Shop panes over `shopStock(kind)` in the shared list+detail shape, with buy actions
- [x] 4.2 Tool Shop and Inventory/Bank panes ported into the shell (rename Bank → Inventory/Bank; equip/sell unchanged)
- [x] 4.3 Stat-preview rendering in shop detail panes for equippable offers ("if bought and equipped")

## 5. UI — Equipment pane (design D6)

- [x] 5.1 Slot list (weapon/frame/barrier/units with capacity) → candidate list (inventory items for slot + remove option) with UI-local slot/candidate selection
- [x] 5.2 Stat-preview diff table (ATP/DFP/ATA/EVP/LCK/HP, ▲/▼/— markers) from `previewStats`; confirm action equips/removes; displaced gear returns to inventory
- [x] 5.3 Move grind action here (weapon slot, when equipped); remove the old hub equipment panel
- [x] 5.4 Equip disabled with a hint when unit capacity is full (replacement UX deferred per design)

## 6. Verification

- [x] 6.1 Full test suite + RNG-purity test pass; typecheck clean
- [x] 6.2 Manual pass: load a v2 save (migration), walk all seven sidebar entries, equip via preview, buy from both shops, run a quest and dismiss the report on the Guild pane
