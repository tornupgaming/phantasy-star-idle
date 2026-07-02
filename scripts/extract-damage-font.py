#!/usr/bin/env python3
"""Extract PSO damage-number glyphs from Gulim's embedded bitmap strikes.

Reads the embedded bitmap (EBDT/EBLC) glyphs for `0123456789MIS` from
assets_to_ingest/GULIM.TTC (face 0, "Gulim") and writes a glyph atlas + metrics
for the battle stage's floating combat text. Tints are baked in as stacked rows
(white = damage, gold = crit, red = MISS; matching the CSS palette) because
runtime filter/mask tinting cannot keep the 1-bit pixels crisp:

    src/ui/assets/damage-font.png
    src/ui/assets/damage-font.json

Browsers rasterize font outlines and ignore embedded bitmap strikes, so this
pre-rendered atlas is the only way to get the authentic PSO:BB pixel look.
The TTC itself is never bundled; only these ~13 glyphs ship.

One-time generation; both outputs are committed. Requires fontTools:

    python3 -m venv .venv && .venv/bin/pip install fonttools
    .venv/bin/python scripts/extract-damage-font.py

Deterministic: same TTC in, same PNG/JSON out.
"""

import json
import struct
import sys
import zlib
from pathlib import Path

from fontTools.ttLib import TTCollection

ROOT = Path(__file__).resolve().parent.parent
TTC = ROOT / "assets_to_ingest" / "GULIM.TTC"
OUT_DIR = ROOT / "src" / "ui" / "assets"
CHARS = "0123456789MIS"
PPEM = 16  # matches the stage's current 16px damage text; crits scale x2
GUTTER = 1
# Tint rows, top to bottom. Colors mirror styles.css (:root --gold / --bad).
TINTS = [("white", b"\xff\xff\xff\xff"), ("gold", b"\xff\xd7\x6a\xff"), ("red", b"\xff\x6b\x7d\xff")]


def write_png(path, width, height, rgba_rows):
    def chunk(tag, payload):
        data = tag + payload
        return struct.pack(">I", len(payload)) + data + struct.pack(">I", zlib.crc32(data))

    raw = b"".join(b"\x00" + row for row in rgba_rows)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def glyph_pixels(glyph, metrics):
    """Decode a 1-bit EBDT glyph into a set of (x, y) lit pixels."""
    lit = set()
    for row in range(metrics.height):
        row_bytes = glyph.getRow(row, bitDepth=1, metrics=metrics, reverseBytes=False)
        bits = "".join(f"{b:08b}" for b in row_bytes)[: metrics.width]
        for x, bit in enumerate(bits):
            if bit == "1":
                lit.add((x, row))
    return lit


def main():
    font = TTCollection(str(TTC), lazy=True).fonts[0]
    assert font["name"].getDebugName(1) == "Gulim", "expected face 0 to be Gulim"
    cmap = font.getBestCmap()
    eblc, ebdt = font["EBLC"], font["EBDT"]

    sizes = [s.bitmapSizeTable.ppemX for s in eblc.strikes]
    print(f"available bitmap strikes (ppem): {sizes}")
    strike_index = next(i for i, s in enumerate(eblc.strikes) if s.bitmapSizeTable.ppemX == PPEM)
    strike_data = ebdt.strikeData[strike_index]

    glyphs = []
    for ch in CHARS:
        glyph = strike_data[cmap[ord(ch)]]
        m = glyph.metrics
        glyphs.append((ch, m, glyph_pixels(glyph, m)))

    ascent = max(m.BearingY for _, m, _ in glyphs)
    descent = max(m.height - m.BearingY for _, m, _ in glyphs)
    cell_h = ascent + descent
    row_h = cell_h + GUTTER
    height = GUTTER + row_h * len(TINTS)

    # Pack each tint in one horizontal row; each cell is the glyph's advance
    # wide so the UI can lay spans flush with authentic spacing.
    cells = {}
    x = GUTTER
    for ch, m, _ in glyphs:
        w = max(m.Advance, m.BearingX + m.width)
        cells[ch] = (x, w)
        x += w + GUTTER
    width = x

    rows = [bytearray(width * 4) for _ in range(height)]
    tint_rows = {}
    for t, (tint_name, rgba) in enumerate(TINTS):
        base_y = GUTTER + t * row_h
        tint_rows[tint_name] = base_y
        for ch, m, lit in glyphs:
            cx, _ = cells[ch]
            ox = cx + m.BearingX
            oy = base_y + ascent - m.BearingY
            for px, py in lit:
                i = (ox + px) * 4
                rows[oy + py][i : i + 4] = rgba

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_png(OUT_DIR / "damage-font.png", width, height, rows)
    meta = {
        "ppem": PPEM,
        "width": width,
        "height": height,
        "cellHeight": cell_h,
        "tintY": tint_rows,
        "glyphs": {ch: {"x": x, "w": w} for ch, (x, w) in cells.items()},
    }
    (OUT_DIR / "damage-font.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"wrote {OUT_DIR / 'damage-font.png'} ({width}x{height}) and damage-font.json")


if __name__ == "__main__":
    sys.exit(main())
