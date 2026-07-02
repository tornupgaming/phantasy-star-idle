## Why

The Pioneer 2 hub is currently a single screen that navigates *away* to full-screen
shop/bank sub-screens, and equipping gear is buried in the Bank as a one-line
"Equipped:" comparison. This restructures the hub into a persistent master-detail
shell — closer to how PSO's Pioneer 2 counters feel — and adds the original
PSO-style equip flow: pick a slot, browse candidates, watch the stats change,
confirm.

## What Changes

- The Pioneer 2 hub becomes a **master-detail layout**: a persistent sidebar with
  entries **Hunters Guild, Weapon Shop, Armour Shop, Tool Shop, Equipment,
  Inventory/Bank, Change Character**; the selected entry renders in the detail
  pane. The standalone `shop-gear`, `shop-tool`, and `bank` screens are replaced
  by panes inside the hub shell.
- A **PSO-style status bar** appears at the top of every hub pane, modeled on the
  BB character window: name, class, section ID, level, Total Exp, To Next Lv, and
  Meseta (grinder count retained). Character select/create and the run view keep
  their own headers.
- The single mixed gear stock is **split into a weapon stock and an armour stock**
  (armour shop sells frames, barriers, and units, matching PSO). Each stock holds
  its own offers per level band. **BREAKING**: `RosterEntry.shop` shape changes in
  the persisted save → `SAVE_VERSION` bump to 3 with a migration (stocks are
  deterministic per (characterId, band, restock), so migration regenerates them).
- A new **Equipment pane** implements the PSO equip flow: selecting a slot
  (weapon / frame / barrier / units) lists equippable candidates from the shared
  inventory plus an unequip option; highlighting a candidate shows a **live stat
  preview diff** (current → with-candidate, per stat, with up/down markers);
  confirming equips it. Grind and unequip actions move here from the old hub
  panel. The same stat preview appears in the weapon/armour shop detail panes.
- **Hunters Guild pane** absorbs the existing quest counter (area, difficulty,
  attack pattern, loot filter, supply, accept quest) and is the default pane on
  entering the hub; the post-run report dialog appears over it.
- **Inventory/Bank pane** is the existing bank list+detail (equip/sell) renamed;
  the shared single pool is unchanged (no per-character inventory split).
- **Change Character** is a sidebar action that exits to character select (not a
  pane).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ui-navigation`: hub requirement replaced by the master-detail shell (sidebar +
  panes + status bar); shop/bank sub-screen requirement replaced by in-hub panes;
  new Equipment-pane requirement covering the slot → candidates → preview → equip
  flow; post-run report anchored to the Hunters Guild pane.
- `loot-economy`: shop purchasing requirement changes from one mixed gear stock to
  separate weapon and armour stocks (armour = frames + barriers + units), each
  deterministic per level band.
- `character-equipment`: new requirement for a pure stat-preview computation —
  effective stats as-if a candidate item were equipped in a slot, without mutating
  the character.

## Impact

- `src/ui/views.ts` — major restructure: `Screen` type collapses hub sub-screens
  into a hub shell + `Pane` state; new status bar, sidebar, Equipment pane, stat
  preview rendering.
- `src/ui/styles.css` — sidebar/status-bar/preview layout styles.
- `src/engine/shop.ts` — split stock generation and pools; `src/engine/game.ts` —
  `RosterEntry.shop` shape, `shopStock()`/`buyGearFromShop()` per shop kind.
- `src/engine/save.ts` — `SAVE_VERSION` 2 → 3 plus migration.
- `src/engine/character.ts` — pure `previewStats` helper (no behavior change to
  existing equip/unequip).
- Engine purity rules unaffected: stock generation stays on the seeded RNG;
  replays untouched.
