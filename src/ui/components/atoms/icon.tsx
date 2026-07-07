/** SVG sprite icon (item-iconography): `<use>` reference into the hidden sprite sheet. */

import { iconForKind, type IconId } from "../../icons";

/**
 * `class` overrides sizing (e.g. the 16px/align-[-3px] variant used inside
 * detail headers) — kept as a single override rather than stacking size
 * utilities, since same-specificity Tailwind utilities resolve by generation
 * order, not by position in the class list.
 */
export function Icon(props: { id: IconId; class?: string }) {
  return (
    <svg class={`icon flex-none ${props.class ?? "w-3.5 h-3.5 align-[-2px]"}`} aria-hidden="true">
      <use href={`#i-${props.id}`} />
    </svg>
  );
}

export function KindIcon(props: { kind: string; class?: string }) {
  return <Icon id={iconForKind(props.kind)} class={props.class} />;
}
