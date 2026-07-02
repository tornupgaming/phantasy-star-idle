## Context

The UI (`src/ui/views.ts`) is a screen router (`select | create | hub | shop-gear
| shop-tool | bank`) rendering full HTML strings per screen. The hub is a
three-panel screen whose counter-directory buttons navigate away to full-screen
sub-pages. Equipping happens in the Bank via a one-line text comparison against
the equipped piece. Shop stock is one mixed pool of 4 offers per character
(`RosterEntry.shop: ShopStock`), persisted in the save (v2). `effectiveStats()`
in `engine/character.ts` is pure. Constraints: engine stays pure/deterministic
(seeded RNG only); UI stays vanilla-DOM string rendering; save shape changes
need a `SAVE_VERSION` bump and migration decision.

Visual reference for the status bar: PSO BB's character window (name, class,
section ID icon, Lv, Total Exp, To Next Lv, Money).

## Goals / Non-Goals

**Goals:**
- Persistent hub shell: status bar + sidebar + detail pane, sidebar entries
  Hunters Guild / Weapon Shop / Armour Shop / Tool Shop / Equipment /
  Inventory-Bank / Change Character.
- PSO-authentic equip flow with a live stat diff preview, reused in shops.
- Engine-level weapon/armour shop split with a clean save migration.

**Non-Goals:**
- No per-character inventory vs. account bank split — the shared pool stays;
  "Inventory/Bank" is a rename of the existing bank pane.
- No changes to combat math, run simulation, loot generation, or the run view.
- No changes to character select/create screens beyond what the router refactor
  forces; they keep their own headers (no status bar — select has no selected
  character).
- No visual-theme overhaul; reuse existing `pso-*` CSS primitives.

## Decisions

### D1 — Router: `hub` screen + UI-local `pane` state
Keep the existing `Screen` router but collapse `shop-gear`/`shop-tool`/`bank`
into the single `hub` screen with a new `pane` field
(`guild | weapon-shop | armour-shop | tool-shop | equipment | bank`). "Change
Character" is a sidebar action calling `goto("select")`, not a pane. Pane state
is UI-local and never persisted (matches the existing router rule); entering the
hub always lands on `guild`, and the post-run report dialog renders over
whichever pane is active (which is `guild`, since a settling run forces
`hub`). Alternative — seven top-level screens sharing a shell helper — rejected:
the shell (status bar + sidebar) is persistent chrome, not navigation, and pane
switching shouldn't reset shared state like `detailId` handling differently per
screen.

### D2 — Status bar replaces the topbar on hub panes
One `statusBar()` renderer at the top of the hub shell: character name, class,
section ID, Lv, Total Exp (`character.xp`), To Next Lv
(`xpForLevel(class, level+1) - xp`, "max" at cap), Meseta, grinders. Data is all
available from `selectedEntry()` + `economy`; no engine change. Select/create
keep the existing `topbar()`; the run shell is untouched.

### D3 — Shop split lives in the engine, not a UI filter
`engine/shop.ts` gains two pools and a `ShopKind = "weapon" | "armour"`:
weapon pool = weapon templates; armour pool = frames + barriers + units
(PSO-authentic). `generateGearStock(characterId, kind, band, restock)` seeds the
RNG with `shop-${kind}-${characterId}-${band}` so the two stocks draw
independent streams; each holds up to `STOCK_SIZE` offers. `RosterEntry.shop`
becomes `{ weapon: ShopStock; armour: ShopStock }`; `Game.shopStock(kind)` and
`buyGearFromShop(kind, offerId)` take the kind. Alternative — UI-side filter of
the existing mixed stock — rejected: a 4-offer stock split two ways leaves shops
routinely near-empty, defeating the point of dedicated counters.

### D4 — Save migration v2 → v3: regenerate stocks
`SAVE_VERSION` → 3. Migration maps each roster entry's old `shop` to fresh
`weapon`/`armour` stocks generated at the character's current band with
`restock: 0`, discarding old offers. Justified because stock is already
ephemeral by design (regenerates on band change) and offers are unpurchased
shop copies — nothing owned by the player is lost. Determinism is unaffected:
stock generation stays on the seeded RNG and replays don't involve shops.

### D5 — Stat preview is a pure engine helper
`previewStats(character, slot, item | null)` in `engine/character.ts`: builds a
shallow-cloned equipment with the candidate in the slot (null = unequip; for
units, add/remove within capacity) and returns `effectiveStats` of the clone —
no mutation. The UI renders a per-stat diff table (ATP/DFP/ATA/EVP/LCK/HP) with
▲/▼/— markers. Placed in the engine (not UI) because it must stay consistent
with `effectiveStats` composition rules and is unit-testable there. Equip
legality checks reuse the existing `equip()` result shape rather than
duplicating rules.

### D6 — Equipment pane: slot list → candidates → preview
Three-column pane: slots (Weapon, Frame, Barrier, Units with capacity), then
candidates for the selected slot (inventory items of that kind, plus "Remove
equipped" when occupied), then the stat preview + Equip/Remove/Grind actions.
Selecting a candidate only updates UI state (`slotSel`, `candidateSel`) and
re-renders; nothing is committed until Equip. Grind moves here from the old hub
panel and appears on the weapon slot when a weapon is equipped. Shop detail
panes reuse the same preview renderer against the shop offer ("if bought and
equipped").

### D7 — Rendering strategy unchanged
Keep full-string re-render + `bind()` per interaction (existing pattern). The
sidebar/status bar are cheap to rebuild; only the battle stage needs mounted
persistence, and it is out of scope. Alternative — incremental DOM updates for
pane switches — rejected as premature for this codebase's size.

## Risks / Trade-offs

- [Old saves carry the mixed `shop` shape] → v3 migration regenerates both
  stocks; a test covers loading a v2 fixture.
- [Two stocks double shop content; early bands have few armour templates] →
  seed pools so each kind has ≥2 band-0 templates; acceptable if early stocks
  hold fewer than `STOCK_SIZE` offers.
- [`views.ts` grows past comfortable size with the Equipment pane] → split hub
  panes into a `ui/hub/` module (or at least separate functions) during
  implementation; pure refactor, no behavior risk.
- [Preview for units is ambiguous when slots are full] → preview "add unit"
  only when capacity remains; otherwise candidates show per-unit "replace"
  entries in a later change (out of scope — Equip stays disabled at capacity
  with a hint).
- [Status bar on select/create was arguably "every page"] → deliberate
  exclusion (no selected character there); revisit if it feels inconsistent.

## Migration Plan

1. Engine: shop split + `previewStats` + save v3 migration (tests first — RNG
   purity test already guards ad-hoc randomness).
2. UI: hub shell (status bar + sidebar + pane router), port existing panes,
   then the new Equipment pane.
3. Manual pass: load a v2 save, verify migration, walk all seven sidebar
   entries, equip via preview, buy from both shops.
Rollback: revert commit; v2 saves untouched until first v3 write.

## Open Questions

- None blocking. Unit-replacement UX at full capacity deferred (see risk above).
