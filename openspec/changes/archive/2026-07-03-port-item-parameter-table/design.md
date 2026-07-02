# Design: port-item-parameter-table

## Context

The engine's item model (`items.ts`) supports weapons, frames, barriers, and units with a clean stat surface, but the only definitions are ~15 invented templates in `content.ts`. newserv's `system/tables/item-parameter-table-bb-v4.json` holds the authentic BB table: a flat `Items` map keyed by hex item code (`TTGGII` — type byte, group byte, index byte; mags abbreviate to 4 digits `TTGG`), 1,536 entries, with per-kind field shapes matching the structs in `ItemParameterTable.hh` (`Weapon`, `ArmorOrShield`, `Unit`, `Mag`, `Tool`). `names-v4.json` maps the same codes to display names. Side tables include `StarValues` (rarity, indexed by each entry's `ID` minus `StarValueBaseIndex`), sale divisors per kind, `Specials`, and several we don't need (`MagFeedResults`, `ItemCombinations`, `SoundRemaps`, `PhotonColors`, weapon trails/skins).

Two constraints shape the design:

1. **The source files are not standard JSON** — they carry `//` comments and hex literals (`0xFF`, `-0x1`), newserv's phosg JSON dialect. They cannot be shipped to or parsed by the client as-is.
2. **The repo already has the right pattern**: `scripts/extract-battle-params.mjs` → `src/engine/data/enemy-stats.json` + typed loader, deterministic byte-identical regeneration, upstream-drift detection (enemy-stat-data spec).

## Goals / Non-Goals

**Goals:**

- Authentic, data-driven definitions for all weapons, frames, barriers, and units: stats, equip requirements, max grind, star-value rarity, class usability, sale value, display name.
- Deterministic build-time extraction; the client ships one standard-JSON dataset, not the raw newserv files.
- Equip-requirement enforcement in the engine (`character.ts`).
- Keep the attack-speed seam open for authentic frame data later.

**Non-Goals:**

- Wiring extracted items into drop tables, shop stock, or run rewards (curated `GEAR` stays the circulating set).
- Mag mechanics, tool/tech consumption, weapon specials' combat effects, per-instance attribute rolls, DFP/EVP range rolls on armor drops.
- Authentic attack-animation frame data (wiki.pioneer2.net) — deferred follow-up; this change only carries the weapon group needed to key it.

## Decisions

### D1: Extract to a pruned standard-JSON dataset, not ship raw files

`scripts/extract-item-table.mjs` (node, zero deps, mirroring `extract-battle-params.mjs`) reads the two newserv files, strips comments, rewrites hex literals, `JSON.parse`s, then emits `src/engine/data/item-table.json`.

*Alternative considered*: shipping the raw 794KB+336KB files with a client-side dialect parser. Rejected: custom parser in the client, double payload full of render fields (`Skin`, `Trail*`, `Photon`, `Color`) and unused sections, and it breaks the repo rule that generated data is standard JSON.

The dialect rewrite is textual and deliberately dumb: strip `//`-to-EOL outside strings, replace `-?0x[0-9A-Fa-f]+` tokens with decimal. The extractor fails loudly (no output written) if the parsed shape drifts from expectations — same drift-detection stance as the enemy pipeline.

### D2: Dataset shape — one file, kind-segregated, names joined, codes as keys

```jsonc
{
  "weapons":  { "000100": { "name": "Saber", "group": 1, "weaponKind": 1,
                            "atpMin": 40, "atpMax": 55, "ata": 30, "mst": 0, "maxGrind": 35,
                            "atpRequired": 30, "ataRequired": 0, "mstRequired": 0,
                            "usableBy": 255, "special": 0, "stars": 0,
                            "saleDivisor": 15 }, ... },
  "frames":   { "010100": { "name": "Frame", "dfp": 5, "evp": 5, "dfpRange": 2, "evpRange": 2,
                            "efr": 5, "eic": 0, "eth": 0, "elt": 0, "edk": 5,
                            "requiredLevel": 0, "usableBy": 255, "stars": 0 }, ... },
  "barriers": { "0102xx": { /* same shape as frames */ } },
  "units":    { "0103xx": { "name": "Knight/Power", "stat": 0, "statAmount": 5,
                            "modifierAmount": 1, "stars": 0 } },
  "mags":     { "020000": { "name": "Mag", ... } },      // extracted, unconsumed
  "tools":    { "03xxxx": { "name": "Monomate", ... } }  // extracted, unconsumed
}
```

- Keys are the 6-hex-digit item codes — the stable identity shared with names, and later with drop tables.
- Source key quirk: mag entries are keyed by 4-digit codes (`0200`…`0252`) while everything else uses 6; the extractor normalizes mags to 6 digits (append `00`, the form `names-v4.json` uses). Per-kind counts: 903 weapons, 89 frames, 166 barriers, 101 units, 83 mags, 194 tools = 1,536.
- A handful of entries (~20, e.g. the bare-hands entry `000000` and unnamed tech-disk slots) have no entry in `names-v4.json`; they get `name: null` and are excluded from the loader's `all*()` iterators.
- `stars` is resolved at extraction time (`StarValues[entry.ID − StarValueBaseIndex]`) so the client never sees the indirection.
- Sale divisors are inlined per weapon and emitted once per kind for the others (`ArmorSaleDivisor` etc.).
- All values decimal; keys sorted; fixed field order; 2-space indent — regeneration must be byte-identical.
- Mags/tools keep only their obviously meaningful fields (mags: feed table, photon blast, activation; tools: cost, amount, tech); nothing consumes them yet, so their shape is best-effort and explicitly non-contractual.

*Alternative considered*: emitting only the four consumed kinds. Rejected per scope decision — extracting everything now means drop-table work later touches no extraction code.

### D3: Typed loader mirrors `enemy-stats.ts`

`src/engine/data/item-table.ts` imports the JSON, exposes typed interfaces (`WeaponDef`, `FrameDef`, `BarrierDef`, `UnitDef`) and lookup functions (`weaponDef(code)`, `allWeapons()`, …). It is the only module that reads the JSON. `items.ts` instance types stay as they are; a small adapter (`templateFromCode(code): GearTemplate`) bridges a definition to the existing instance/template model — `atpMin`→`minAtp`, `atpMax−atpMin`→`spread`, `stars`→rarity bucket, divisor→`sellValue`. Nothing in this change calls it from live content, but it is the supported entry point and gets tested.

### D4: Rarity from stars

`stars 0–3 → common`, `4–8 → uncommon`, `≥9 → rare` (buckets chosen so the existing three-tier UI keeps working; the raw `stars` value is preserved on the definition for future use). The bucket function lives in the loader, not the extractor, so retuning buckets doesn't regenerate data.

### D5: WeaponKind → speed archetype lookup (temporary)

The group byte is NOT a usable speed key — BB has 236 weapon groups, most holding a single rare weapon. The table itself carries the right key: `WeaponKind`, the authentic animation/behavior category (verified: RED SWORD→2/sword, FROZEN SHOOTER→7/rifle, PSYCHO WAND→11/rod, EXCALIBUR→1/saber). Its 19 values are: 0 fist, 1 saber, 2 sword, 3 dagger, 4 partisan, 5 slicer, 6 handgun, 7 rifle, 8 mechgun, 9 shot, 10 cane, 11 rod, 12 wand, 13 claw, 14 double-saber, 15 twin-sword, 16 katana, 17 launcher, 18 card — the same categories the pioneer2 frame-data tables use.

The extractor emits `weaponKind`; `pacing.ts` gains `WEAPON_KIND_ARCHETYPE`: a total 19-entry map onto the existing five speed archetypes, grouped by tempo (fast melee→saber, slow melee→sword, fast ranged→handgun, slow ranged→rifle, medium→cane). `comboStepMs` behavior is unchanged for existing content. When pioneer2 frame data lands, this table is deleted and replaced by (weaponKind × class) frame values — the item data won't change.

*Alternatives considered*: mapping the 236 group bytes (untenable hand-maintenance, and groups don't determine animation); expanding the speed table to 19 rows now with invented values (invents exactly the data the follow-up will replace).

### D6: Equip-requirement enforcement in `character.ts`

Requirements become optional fields on the item instance/template model (`requirements?: { atp?, ata?, mst?, level?, usableBy? }`). `equip()` validates against the character's **base** stats (PSO checks base, not equipped, stats for weapon requirements) and class bit; failures return the existing error-result shape used by slot/unit-slot validation. Curated `GEAR` templates carry no `requirements`, so current gameplay and saves are untouched.

`usableBy` is an **attribute** bitmask, not a per-class one (`ItemParameterTable.hh:59-67`): bits are 01 hunter, 02 ranger, 04 force, 08 human, 10 android, 20 newman, 40 male, 80 female, and an item is usable only if **all** bits for the character's attributes are set. Each of the 12 classes has a fixed attribute set (e.g. HUmar = hunter|human|male); a 12-entry table in the engine maps `classes.ts` ids to attribute masks, and the check is `(usableBy & classMask) === classMask`.

### D7: No save migration

No persisted shape changes: item instances gain only optional fields, `defId`s of circulating items are unchanged, and requirement checks happen at equip time. `SAVE_VERSION` stays put. (When drop tables move to item codes later, *that* change owns the defId migration.)

## Risks / Trade-offs

- [Dialect parsing by regex could corrupt a string containing `//` or `0x`] → names are the only strings; extractor asserts round-trip sanity (entry count 1,453, spot-check known values: Saber `000100` ATPMax, Frame `010100` DFP) and refuses to write output on mismatch.
- [Upstream newserv format drift] → same stance as enemy pipeline: hard assertions on top-level keys and per-kind field presence; fail loudly, write nothing.
- [Stars→rarity buckets are a design choice, not authentic] → raw `stars` kept on every definition; buckets are one function in the loader.
- [Group→archetype lookup bakes in wrong feel for exotic groups (shots, mechguns)] → explicitly temporary (D5); nothing ships to players since no extracted weapon is in circulation yet.
- [Dataset size in the bundle (~est. 300–500KB pruned)] → acceptable per proposal; JSON imports are code-split-able later if it matters; pruning render fields keeps it well under the raw 1.1MB.
- [Requirement checks against base stats could conflict with future stat-boost items] → matches authentic PSO behavior; documented in the spec scenario.

## Open Questions

- Whether `Specials` (the named special-attack list) is worth emitting in this change or left to the follow-up that implements special effects. Default: emit the id only (already on weapon entries), skip the side table.
