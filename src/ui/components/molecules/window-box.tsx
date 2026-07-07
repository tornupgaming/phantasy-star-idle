import { Show, type JSX } from "solid-js";

import chrome from "../chrome.module.css";

/**
 * A named HUD window: orange tab header (title + optional trailing meta)
 * overlapping a pso-window body (pso-visual-theme "tab header" requirement).
 */
export function WindowBox(props: { title: string; trailing?: string; children: JSX.Element }) {
  return (
    <section class={`win ${chrome.surface} rounded-[4px_18px_4px_12px] mt-[13px] p-0 flex flex-col min-h-0`}>
      <div class={chrome.tab}>
        <span>{props.title}</span>
        <Show when={props.trailing}>
          <span class="font-semibold text-[11px] text-[#fff3d0]">{props.trailing}</span>
        </Show>
      </div>
      <div class="pt-4 px-3 pb-3 overflow-auto min-h-0">{props.children}</div>
    </section>
  );
}
