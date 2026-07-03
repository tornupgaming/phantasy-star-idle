/**
 * Inline SVG item glyphs (item-iconography spec). One hidden <symbol> sprite is
 * embedded per screen render; rows reference glyphs with <use>. Everything is
 * stroked/filled with currentColor so rarity and equipped-state coloring apply
 * to the glyph for free.
 */

export type IconId =
  | "saber"
  | "frame"
  | "barrier"
  | "unit"
  | "mate"
  | "atomizer"
  | "grinder"
  | "meseta";

/** Item-kind → glyph mapping (consumable kinds included). */
export function iconForKind(kind: string): IconId {
  switch (kind) {
    case "weapon":
      return "saber";
    case "frame":
      return "frame";
    case "barrier":
      return "barrier";
    case "unit":
      return "unit";
    case "heal":
      return "mate";
    case "revive":
      return "atomizer";
    case "grinder":
      return "grinder";
    case "tool":
      return "mate"; // inert tools (fluids, sols, …) fall back to the flask glyph
    default:
      return "meseta";
  }
}

export function icon(id: IconId): string {
  return `<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;
}

/** 16×16 viewBox glyphs, deliberately chunky so they read at 12–14px. */
export function spriteDefs(): string {
  return `<svg class="icon-defs" aria-hidden="true" style="display:none">
    <symbol id="i-saber" viewBox="0 0 16 16">
      <path d="M2.5 13.5 11 5l2-3.5L9.5 3.5 1 12z" fill="currentColor"/>
      <path d="M10.5 10.5l3 3M12 9l2 2" stroke="currentColor" stroke-width="1.5" fill="none"/>
    </symbol>
    <symbol id="i-frame" viewBox="0 0 16 16">
      <path d="M8 1.5 14 4v4c0 3.5-2.5 6-6 6.5C4.5 14 2 11.5 2 8V4z" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M8 4.5 11.5 6v2.2c0 2-1.4 3.4-3.5 3.8-2.1-.4-3.5-1.8-3.5-3.8V6z" fill="currentColor"/>
    </symbol>
    <symbol id="i-barrier" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <circle cx="8" cy="8" r="2.6" fill="currentColor"/>
    </symbol>
    <symbol id="i-unit" viewBox="0 0 16 16">
      <rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M6 3V1M10 3V1M6 15v-2M10 15v-2M3 6H1M3 10H1M15 6h-2M15 10h-2" stroke="currentColor" stroke-width="1.4"/>
      <rect x="6" y="6" width="4" height="4" fill="currentColor"/>
    </symbol>
    <symbol id="i-mate" viewBox="0 0 16 16">
      <path d="M6 2h4M7 2v3l3.5 6a2.5 2.5 0 0 1-2.2 3.8H7.7A2.5 2.5 0 0 1 5.5 11L9 5V2" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M6.2 10.5h3.6l1 1.8a1.4 1.4 0 0 1-1.3 1.5H6.5a1.4 1.4 0 0 1-1.3-1.5z" fill="currentColor"/>
    </symbol>
    <symbol id="i-atomizer" viewBox="0 0 16 16">
      <path d="M8 1.5 9.5 6 14 7.5 9.5 9 8 13.5 6.5 9 2 7.5 6.5 6z" fill="currentColor"/>
      <circle cx="12.5" cy="12.5" r="1.5" fill="currentColor"/>
    </symbol>
    <symbol id="i-grinder" viewBox="0 0 16 16">
      <path d="M8 2a6 6 0 1 1-6 6" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M8 5v3l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M2 8l1.8-1 .2 2.2z" fill="currentColor"/>
    </symbol>
    <symbol id="i-meseta" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M5.5 11V5.5L8 9l2.5-3.5V11" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </symbol>
  </svg>`;
}
