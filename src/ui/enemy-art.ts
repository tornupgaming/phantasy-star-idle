/**
 * Enemy sprite lookup. Images live in assets/enemies/, one per enemy display
 * name in kebab-case ("Poison Lily" → poison-lily.png), including Ultimate
 * rename variants (bartle.png, vulmer.png, ...). Lookup falls back from the
 * difficulty-specific display name to the base enemy (an Ultimate variant
 * without its own art reuses the base sprite); enemies with no art at all
 * (e.g. the Dragon) keep the placeholder box.
 */

const urls = import.meta.glob("./assets/enemies/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const byKey: Record<string, string> = {};
for (const [path, url] of Object.entries(urls)) {
  const key = path.replace(/^.*\//, "").replace(/\.png$/, "");
  byKey[key] = url;
}

const kebab = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * URL for an enemy's sprite, or null when no art exists. `displayName` is the
 * (possibly Ultimate-renamed) name shown in the scene; `baseId` is the roster
 * definition id (already kebab-case, e.g. "savage-wolf") used as fallback.
 */
export function enemyArtUrl(displayName: string, baseId?: string): string | null {
  return byKey[kebab(displayName)] ?? (baseId ? (byKey[baseId] ?? null) : null);
}
