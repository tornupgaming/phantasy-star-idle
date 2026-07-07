import { Show, type JSX } from "solid-js";

/**
 * A named HUD window: orange tab header (title + optional trailing meta)
 * overlapping a pso-window body (pso-visual-theme "tab header" requirement).
 */
export function WindowBox(props: { title: string; trailing?: string; children: JSX.Element }) {
  return (
    <section class="pso-window win">
      <div class="pso-tab">
        <span class="tab-title">{props.title}</span>
        <Show when={props.trailing}>
          <span class="tab-meta">{props.trailing}</span>
        </Show>
      </div>
      <div class="win-body">{props.children}</div>
    </section>
  );
}
