# Tasks — Ep1-complete area selection

## 1. Enemy roster expansion

- [x] 1.1 Add the missing Forest/Cave/Mine roster entries to `ENEMIES` in `content.ts` (Hildebear, Hildeblue, Pouilly Slime + Pofuilly Slime, Dubchic, Garanz, Sinow Blue/Gold variants missing from Mine 2, and any other non-Ruins types flagged by the spawn diff), feel fields per the existing pattern
- [x] 1.2 Add the Ruins roster (Delsaber, Dark Belra, Chaos Sorcerer, Chaos Bringer, Dark Gunner, Death Gunner, Bulclaw/Bulk/Claw, Dimenian/La Dimenian/So Dimenian) and the three new boss entries (De Rol Le, Vol Opt ver.2, Dark Falz form 3)
- [x] 1.3 Extend `rareTypeFor` in `data/map-spawns.ts` with Hildebear→Hildeblue and Pofuilly→Pouilly Slime
- [x] 1.4 Add a test asserting every non-skip-listed spawn type across all Ep1 floors resolves to a roster entry with stat rows at all four difficulties

## 2. Stage generation

- [x] 2.1 Add `SKIPPED_SPAWN_TYPES` to `stage-gen.ts` (DUBWITCH, BEE_L, BEE_R, DARK_GUNNER_CONTROL, DARVANT, DE_ROL_LE_BODY, DE_ROL_LE_MINE, VOL_OPT_1, VOL_OPT_AMP, VOL_OPT_CORE, VOL_OPT_MONITOR, VOL_OPT_PILLAR, PIG_RAY); skip silently, keep the loud throw for unlisted unknown types
- [x] 2.2 Test: boss floors 12–14 generate exactly one room with one boss enemy; Mine 2 and Ruins floors generate with no error and no skipped types present

## 3. Area catalog

- [x] 3.1 Extend `AreaDef` with `zone` and `boss?` fields; add per-floor `AREAS` (14 entries with ids per design D1, curated `recommendedAtp` per D5) and a grouped `AREA_LIST` in display order
- [x] 3.2 Keep `forest`/`caves`/`mines` resolvable via a hidden legacy map in `getArea` (mines keeps `bossFloor: 11`), excluded from `AREA_LIST`
- [x] 3.3 Extend `AREA_NORM_BY_FLOOR` to floors 12–14 (De Rol Le → Mine 1, Vol Opt → Ruins 1, Dark Falz → Ruins 3)
- [x] 3.4 Tests: catalog enumeration (14 areas, grouping, zone order, monotonic rec. ATP), legacy ids resolve but are not listed, mid-run legacy `mines` save replays an identical battle log

## 4. Guild pane UI

- [x] 4.1 Rework `guild-pane.tsx`: central panel = episode chips (Ep2/Ep4 disabled) + difficulty chips + pattern chips + Accept Quest + Counter Settings window; detail panel = zone-grouped destination menu (headings + `pso-menu` rows with rec. ATP, boss rows marked), preserving `data-action`/hook classes
- [x] 4.2 Update `context.tsx` default `areaSel` to the first catalog area
- [x] 4.3 Update hub-page keyboard navigation for the destination menu (arrows traverse rows, skip headings)
- [x] 4.4 Update UI smoke tests for the new pane structure and area ids

## 5. Verification

- [x] 5.1 Full `vitest run` green (determinism, no-Math.random, save round-trip included)
- [x] 5.2 Playcheck: dispatch a Ruins run and a boss run from the new UI, verify settle + report; screenshot the reworked guild pane
