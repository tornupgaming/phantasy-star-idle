/** SVG sprite icon (item-iconography): `<use>` reference into the hidden sprite sheet. */

import { iconForKind, type IconId } from "../../icons";

export function Icon(props: { id: IconId }) {
  return (
    <svg class="icon" aria-hidden="true">
      <use href={`#i-${props.id}`} />
    </svg>
  );
}

export function KindIcon(props: { kind: string }) {
  return <Icon id={iconForKind(props.kind)} />;
}
