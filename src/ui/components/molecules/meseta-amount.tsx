import { Show, type JSX } from "solid-js";
import { MesetaIcon } from "../atoms/meseta-icon";

export function MesetaAmount(props: { value: number; suffix?: JSX.Element | string }) {
  return (
    <span class="meseta-amount" aria-label={`${props.value} meseta`}>
      <span>{props.value}</span>
      <MesetaIcon />
      <Show when={props.suffix}>{(suffix) => <span>{suffix()}</span>}</Show>
    </span>
  );
}
