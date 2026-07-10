# Item icon assets

Canonical item icon art lives here so Vite can bundle it with the UI.

- Weapon shop icons: `src/ui/assets/items/weapons/<normalized-item-name>.png`
- Normalize item names to lowercase kebab-case without punctuation (for example, `Double Saber` → `double-saber.png`).
- Shop cards look up weapon icons by item display name and fall back to the existing inline SVG kind glyph when no matching image is present or an image fails to load.

Ingest log:

- 2026-07-09: moved low-level weapon placeholder PNGs from `assets_to_ingest/weapons/` into `src/ui/assets/items/weapons/`.
