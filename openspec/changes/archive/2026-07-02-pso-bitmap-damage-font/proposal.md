# Proposal: pso-bitmap-damage-font

## Why

Floating damage numbers and MISS text currently render in the page's generic system font, which breaks the PSO aesthetic the rest of the project chases. The authentic PSO:BB look comes from Gulim's *embedded bitmap strikes* (the pixel glyphs GDI used at small sizes) — browsers ignore those tables and antialias the outlines, so simply embedding the font as a web font cannot reproduce the look. A pre-rendered sprite sheet of exactly the glyphs we need does, and avoids shipping the 13.5 MB non-redistributable `GULIM.TTC` in the app.

## What Changes

- Add a build-time extraction script that reads the embedded bitmap strikes from `assets_to_ingest/GULIM.TTC` and emits a small PNG glyph atlas + JSON metrics file (digits `0-9` and the letters `M`, `I`, `S` for "MISS") into `src/ui/assets/` (or equivalent). The raw TTC itself is never bundled or served.
- Floating damage numbers (`.float-dmg`, including crits) render from the atlas as pixel-crisp sprites (`image-rendering: pixelated`, integer scaling) instead of DOM text.
- Floating MISS text renders from the atlas and changes color from muted gray to **red**, matching real PSO.
- Crit damage keeps its current distinction (gold tint, larger scale) but rendered via the atlas.
- Log and ticker `l-miss` lines are intentionally unchanged (in-game PSO only reddens the floating text).

## Capabilities

### New Capabilities

_None._ (The extraction script is a build-time tool serving the modified view capability; it has no runtime behavior of its own.)

### Modified Capabilities

- `battle-scene-view`: floating damage numbers and the MISS indicator SHALL render using the PSO bitmap glyph atlas with pixel-crisp scaling; the MISS indicator SHALL be red.

## Impact

- **Code**: `src/ui/stage.ts` (`float()` spawns atlas-based glyph elements instead of text spans), `src/ui/styles.css` (`.float-dmg`, `.float-miss` rules), new script under `scripts/` (e.g. `extract-damage-font.py` using fontTools, or a Node equivalent), new committed assets (glyph atlas PNG + metrics JSON).
- **Dependencies**: extraction needs `fontTools` (Python) at asset-generation time only; no new runtime dependencies. The generated atlas is committed, so contributors/CI never need the TTC or fontTools.
- **Engine**: untouched — this is purely presentation (`src/ui/*`), consistent with the thin-UI rule.
- **Licensing**: only ~13 tiny rendered glyph bitmaps ship, not the Microsoft font file. Noted as an accepted risk for this private project; swapping the atlas source for a free lookalike (e.g. DotGothic16) later only requires re-running the script.
