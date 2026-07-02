# Design: pso-bitmap-damage-font

## Context

Floating combat text is spawned by `Stage.float()` (`src/ui/stage.ts:272`), which appends a text `<span>` styled by `.float-dmg` / `.float-dmg.crit` / `.float-miss` (`src/ui/styles.css:434-457`) and removes it on `animationend`. Call sites are the `attack` branch of `playEvent()` (`src/ui/stage.ts:127-139`) — damage numbers for hits, `"MISS"` for misses, for both the character and enemies.

The desired PSO:BB look comes from Gulim's embedded bitmap strikes (`EBDT`/`EBLC` tables in `assets_to_ingest/GULIM.TTC`). Browsers rasterize outlines and ignore embedded bitmaps, so a web font cannot reproduce it; the TTC is also 13.5 MB, a TrueType Collection (poorly supported in `@font-face`), and not redistributable. Pre-rendering the needed glyphs to a committed sprite atlas sidesteps all three problems.

Constraints: UI stays a thin vanilla-DOM layer with no game logic; the engine is untouched. The project uses Vite, so committed PNG/JSON assets under `src/` can be imported directly.

## Goals / Non-Goals

**Goals:**
- Pixel-faithful PSO damage numbers and MISS text in the battle stage, at crisp integer scales.
- MISS floating text in red, per real PSO.
- Ship only ~13 rendered glyphs; never bundle or serve `GULIM.TTC`.
- One-time generation: the committed atlas means contributors/CI never need the TTC or fontTools.

**Non-Goals:**
- No change to log/ticker `l-miss` styling (PSO only reddens the floating text).
- No general bitmap-font text system for the rest of the UI (chat, menus, item names).
- No engine or save-format changes; purely presentation.
- No runtime font parsing.

## Decisions

### 1. Sprite atlas over web font

Rejected `@font-face` (outline antialiasing destroys the bitmap look; TTC unsupported; licensing exposure of the full font) and canvas-drawing text at runtime (same antialiasing problem). A pre-rendered PNG atlas + JSON metrics is the only route that reproduces the embedded-bitmap glyphs exactly.

### 2. Extraction: Python + fontTools, glyphs `0-9 M I S`

`scripts/extract-damage-font.py` reads the Gulim face (index 0) from the TTC with `fontTools.ttLib.TTCollection`, picks the largest available bitmap strike ≤ ~20 ppem (script logs available strike sizes; final ppem choice is made when we see them), decodes each glyph's bitmap for characters `0123456789MIS`, and writes:

- `src/ui/assets/damage-font.png` — glyphs packed in one row, 1 px gutter, white-on-transparent so CSS/canvas tinting can color them (white for damage, gold for crit, red for MISS).
- `src/ui/assets/damage-font.json` — `{ ppem, glyphs: { "<char>": { x, w, h, advance } } }`.

fontTools is the only tool that reliably decodes `EBDT`/`EBLC`; the existing `scripts/extract-battle-params.mjs` convention is Node, but no Node library reads embedded bitmaps well, so Python is the pragmatic exception. It is a generation-time dependency only (`pip install fonttools`, documented in the script header); the outputs are committed.

Alternative considered: screenshotting glyphs from a running PSOBB client — irreproducible and manual; rejected.

### 3. Rendering: DOM spans with atlas-backed glyph elements

Keep `float()`'s shape — spawn an absolutely-positioned element, reuse the existing `stage-float` animation and `animationend` cleanup — but build the float as a row of glyph `<span>`s, each showing its atlas region via `background-image` + `background-position`, sized from the metrics JSON and scaled by an integer factor (×2 for damage, ×3 for crit — final factors tuned visually) with `image-rendering: pixelated`.

Tinting: the atlas is white; color comes from CSS `filter` on the container (or per-class `mask-image` variant if filter tinting proves muddy — decided during implementation). `.float-miss` gets red (reusing the existing `--bad` variable if suitable), `.float-dmg.crit` keeps gold, `.float-dmg` stays white.

Alternative considered: a `<canvas>` overlay for all floats — more code, breaks the current simple spawn/cleanup model, no benefit at this scale (a few floats/second).

### 4. Fallback

If the atlas fails to load, `float()` falls back to the current text spans, so combat feedback never disappears. The metrics JSON is imported statically (bundled by Vite), so in practice only the PNG can fail.

## Risks / Trade-offs

- [Gulim's strikes may lack a strike at the ideal size, or glyphs may look thin/small at available ppems] → script prints all strike sizes; pick the best and integer-scale up. Worst case, render at the largest strike and scale ×2.
- [`filter`-based tinting can look muddy on some backgrounds] → fall back to CSS `mask-image` with `background-color`, same atlas.
- [Licensing: the shipped glyphs derive from a Microsoft font] → accepted for this private project; atlas source is swappable (re-run script against a free lookalike such as DotGothic16) without touching runtime code.
- [Atlas drift if someone edits the PNG by hand] → regeneration script is committed and deterministic; PNG+JSON always regenerated together.

## Open Questions

- Exact strike ppem and scale factors — resolved by eyeballing once the script prints available sizes and the stage renders.
- Whether crits need any extra flourish (PSO crits flash) — out of scope unless trivial.
