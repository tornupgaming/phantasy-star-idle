/**
 * Bundled raster item icons. Keep asset placement documented in
 * `src/ui/assets/items/README.md`; callers always provide an SVG kind glyph
 * fallback for items without matching art.
 */

import type { Item } from "../engine/items";

const weaponIconModules = import.meta.glob("./assets/items/weapons/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function iconKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const weaponIcons = new Map(
  Object.entries(weaponIconModules).map(([path, url]) => {
    const filename = path.split("/").pop() ?? "";
    return [filename.replace(/\.png$/i, ""), url] as const;
  }),
);

export function itemIconUrl(item: Pick<Item, "kind" | "name">): string | undefined {
  if (item.kind === "weapon") return weaponIcons.get(iconKey(item.name));
  return undefined;
}
