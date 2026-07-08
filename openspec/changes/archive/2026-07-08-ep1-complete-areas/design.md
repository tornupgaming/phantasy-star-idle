# Design — Ep1-complete area selection

## Context

Three curated areas exist today (`forest`/`caves`/`mines` in `content.ts`), each wired to one PSO floor, with the Dragon glued to Mines via `AreaDef.bossFloor`. The data layer is already Ep1-complete: `map-spawns.json` has authentic offline layouts for all 14 Ep1 floors, `enemy-stats.json` has per-difficulty rows for every Ep1 enemy (including bosses), and both drop tables cover Ep1 at all four difficulties. The gaps are the hand-curated enemy roster (26 of ~50 needed Ep1 types), the area catalog itself, boss-floor `area_norm` mappings for floors 12–14, and the guild-pane UI, which lists areas as a flat 3-row menu in the central panel.

Constraints: the engine stays pure and deterministic (stage regenerates from `(area def, seed)` on every resume — area definitions are part of the replay contract); saves are versioned; the guild pane uses PSO menu idioms and must stay keyboard-navigable.

## Goals / Non-Goals

**Goals:**

- Every Ep1 floor selectable as a run area: 10 regular floors + 4 boss arenas.
- Zone-grouped destination UI in the guild pane's right detail panel; episode + difficulty + pattern + counter settings in the central panel.
- Complete Ep1 enemy roster (feel fields only; stats stay data-driven).
- Boss arenas fight a single boss enemy.
- Existing saves (including mid-run and settled-run reports) keep working.

**Non-Goals:**

- Ep2/Ep4 areas (needs drop-table extraction; episode picker ships with Ep1 only enabled).
- Multi-part boss simulation (De Rol Le segments, Vol Opt phases, Darvant waves).
- Area/difficulty unlock gating — everything stays freely selectable, matching the existing "Four selectable difficulties" requirement.
- Rebalancing combat or drops.

## Decisions

### D1: One `AreaDef` per floor, grouped by zone; bosses stand alone

`AreaDef` gains a `zone` field (`"Forest" | "Caves" | "Mines" | "Ruins"`) and a `boss?: true` marker. Ids are per-floor kebab slugs: `forest-1`, `forest-2`, `cave-1`…`cave-3`, `mine-1`, `mine-2`, `ruins-1`…`ruins-3`, `dragon`, `de-rol-le`, `vol-opt`, `dark-falz`. Boss arenas are appended to their authentic zone's group (Dragon under Forest, De Rol Le under Caves, Vol Opt under Mines, Dark Falz under Ruins), matching PSO's zone→boss progression. `bossFloor` gluing is removed from the catalog (the field can be deleted once no def uses it — see D3).

*Alternative considered:* a separate "Bosses" group. Rejected — PSO players expect Dragon after Forest 2; zone grouping also keeps the recommended-ATP ordering monotonic within each group.

### D2: Legacy area ids stay resolvable; no save migration

Persisted state references area ids in two places: the active run's input (replayed on resume) and settled-run reports. Instead of a `SAVE_VERSION` bump + id rewrite, `getArea()` resolves the three legacy ids from a hidden `LEGACY_AREAS` map (`forest`, `caves`, `mines` — kept verbatim, including `mines`' `bossFloor: 11`) that is excluded from the selectable catalog. The persisted shape is unchanged, so no version bump is needed. Critically, a mid-run `mines` save must replay the *identical* stage (Mine 1 + Dragon floor); rewriting its id to `mine-1` would silently change the generated rooms and violate determinism.

*Alternative considered:* version bump + migrate ids, settling any active legacy run at migration time. Rejected — more code, worse player experience (a run in flight gets truncated), and the compat map is three frozen entries.

### D3: Boss floors generate via a stage-gen skip list, single-boss result

The boss floors' authentic layouts include stat-less gadget/part types (floor 12: `DE_ROL_LE_BODY` ×10, `DE_ROL_LE_MINE` ×9; floor 13: everything except `VOL_OPT_2`; floor 14: `DARVANT` ×509). Stage generation gets an explicit `SKIPPED_SPAWN_TYPES` set — `DUBWITCH`, `BEE_L`, `BEE_R`, `DARK_GUNNER_CONTROL`, `DARVANT`, `DE_ROL_LE_BODY`, `DE_ROL_LE_MINE`, `VOL_OPT_1`, `VOL_OPT_AMP`, `VOL_OPT_CORE`, `VOL_OPT_MONITOR`, `VOL_OPT_PILLAR`, `PIG_RAY` — silently dropped during wave processing (the current behavior of throwing on unknown types is kept for types *not* on the list, so genuinely missing roster entries still fail loudly). After skipping, each boss floor naturally yields a single room with one boss: `DRAGON`, `DE_ROL_LE`, `VOL_OPT_2` ("Vol Opt ver.2", the form with stats), `DARK_FALZ_3`. Dark Falz uses the `DARK_FALZ_3` stat rows at all difficulties since that's the spawn type in the layout.

*Alternative considered:* curated hard-coded boss rooms bypassing the layout data. Rejected — the skip-list path keeps stage-gen uniform and data-driven, and the skip list is needed anyway for Mine 2 (`DUBWITCH`) and Ruins (`BEE_L/R`, `DARK_GUNNER_CONTROL`).

### D4: Roster expansion is feel-fields only

~25 new `ENEMIES` entries (Forest 2 Hildebear; Cave 2/3 slimes and Dimenian line additions; Mine 2 Dubchic/Garanz/Sinow variants; the full Ruins roster — Delsaber, Dark Belra, Chaos Sorcerer, Dark Gunner, Bulclaw/Bulk/Claw, Dimenians; bosses). Each entry is `(id, statsType, enemyType, spread, pvarMax)` following the existing pattern; all combat numbers keep coming from `enemy-stats.json`. Rare-variant pairs extend `rareTypeFor` with Hildebear→Hildeblue and Pofuilly Slime→Pouilly Slime (stats rows exist for both).

### D5: `recommendedAtp` stays curated, interpolated across the existing anchors

14 hand-picked values, monotonic within each zone, anchored to today's tuning (Forest 1 = 80, Cave 1 = 170, Mine 1 = 300) and extended through Ruins/bosses against the authentic stat rows. A `balance-sim` sweep can refine them post-merge; computing them from stat rows is more machinery than 14 integers justify.

### D6: Guild pane layout — destination right, everything else central

- **Central panel** (`hud-pane`): the "Hunter's Guild" window with Episode chips (Ep1 active; Ep2/Ep4 rendered disabled), Difficulty chips, Attack-pattern chips, and Accept Quest; below it, the existing "Counter Settings" window (loot filter + supply) moves into the central section.
- **Right detail panel** (`hud-detail`): a "Destination" window with the zone-grouped area menu — zone headings + `pso-menu` rows (name + rec. ATP), boss rows visually marked. Selection state stays the existing UI-local `areaSel` signal, defaulting to `forest-1`.
- Keyboard nav in `hub-page` treats the destination menu as the guild pane's primary menu (arrows traverse rows across group headings; headings are not focusable). Existing behavioral hook classes (`pso-menu-row`, `data-action="area"`, `selected`) are preserved so smoke tests keep working with updated ids.

## Risks / Trade-offs

- **[Replay determinism]** Changing stage-gen wave processing (skip list) alters generated stages for floors that previously threw or weren't reachable — but Mine 2/Ruins were never selectable, so no existing seed can regress. Legacy defs (D2) protect in-flight runs. Mitigation: determinism test re-run + a stage-gen snapshot test over all 14 new areas.
- **[Balance cliff]** Ruins and boss arenas at Ultimate may be untuned relative to gear availability. Accepted: ejection already gates under-geared characters; `recommendedAtp` signals expectations; refinement deferred to a balance pass.
- **[Darvant-less Falz]** Dark Falz as a lone `DARK_FALZ_3` stat block is a big solo fight with no adds — authenticity compromise accepted per proposal (single-enemy bosses).
- **[UI regression surface]** Guild pane is the hub's landing pane and the smoke tests' entry path. Mitigation: keep hook classes/data-attrs stable; run playcheck after implementation.

## Open Questions

None blocking. Deferred: Ep2/Ep4 data extraction (separate change), multi-part bosses, recommended-ATP refinement via `balance-sim`.
