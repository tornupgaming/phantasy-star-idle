# Tasks: pso-bitmap-damage-font

## 1. Glyph atlas extraction

- [x] 1.1 Write `scripts/extract-damage-font.py` (fontTools): open `assets_to_ingest/GULIM.TTC` face 0, list available `EBLC` bitmap strike ppem sizes, and decode glyph bitmaps for `0123456789MIS`
- [x] 1.2 Pick the strike size (largest ≤ ~20 ppem, per design) and emit `src/ui/assets/damage-font.png` (white-on-transparent, 1 px gutters) and `src/ui/assets/damage-font.json` (`ppem`, per-char `x/w/h/advance`) — chose 16 ppem (matches current 16px damage text; crits ×2); cells keyed by `x/w` with shared `cellHeight`
- [x] 1.3 Run the script (`pip install fonttools` if needed), visually inspect the atlas PNG, and commit both generated assets (assets written to `src/ui/assets/`; project is not a git repo, nothing to commit)

## 2. Stage rendering

- [x] 2.1 Add an atlas glyph renderer to `src/ui/stage.ts`: import the metrics JSON and atlas URL, and build a float element as a row of glyph spans (`background-image`/`background-position`, integer scale, `image-rendering: pixelated`)
- [x] 2.2 Rewire `float()` call sites (damage, crit damage, MISS) to use atlas rendering, keeping the existing `stage-float` animation and `animationend` cleanup (tint/scale derived from the float class inside `float()`; call sites unchanged)
- [x] 2.3 Implement the plain-text fallback when the atlas image fails to load (same classes, colors, animation)

## 3. Styling

- [x] 3.1 Update `.float-dmg` / `.float-dmg.crit` / `.float-miss` in `src/ui/styles.css`: tint via `filter` (or `mask-image` if muddy) — white damage, gold crit at larger scale, **red** MISS — resolved as tints baked into the atlas rows (filter/mask both antialias); CSS colors now only style the text fallback, MISS red via `var(--bad)`
- [x] 3.2 Confirm log/ticker `.l-miss` styling is untouched (stays muted)

## 4. Verification

- [x] 4.1 Run the app, watch a battle: damage numbers and MISS render pixel-crisp from the atlas, crits are gold and larger, MISS is red, floats animate and clean up as before (verified via Playwright headless Chromium: captured white damage, gold ×2 crit, red MISS screenshots)
- [x] 4.2 Simulate atlas load failure (rename/block the PNG) and confirm text fallback renders (blocked the image fetch via Playwright route: plain-text "MISS" rendered, 0 glyph spans, computed color = `--bad` red)
- [x] 4.3 Run the existing test suite; confirm no engine/UI regressions and that `GULIM.TTC` is not referenced by the bundle (138 tests pass; `dist/` has no GULIM/TTC reference; the 788-byte atlas is inlined as a data URI)
