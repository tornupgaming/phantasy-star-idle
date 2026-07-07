import { createEffect, onCleanup, onMount } from "solid-js";
import { Backdrop } from "../../backdrop";
import { useUi } from "../../context";

/**
 * Persistent hub scene layer (imperative island, convert-menu-ui-to-solidjs
 * D3): Solid mounts the container and owns the lifecycle; the Backdrop's
 * canvas loop stays fully imperative and is never reactively rendered into.
 * The canvas element survives pane changes and screen changes (hidden, not
 * unmounted, off-hub per hub-scene-backdrop); only the theme is forwarded
 * reactively.
 */
export function BackdropIsland() {
  const ui = useUi();
  let host!: HTMLDivElement;
  onMount(() => {
    const backdrop = new Backdrop(host);
    createEffect(() => {
      if (ui.screen() === "hub") backdrop.setTheme(ui.pane());
    });
    onCleanup(() => backdrop.destroy());
  });
  return <div class="scene-layer" classList={{ "scene-hidden": ui.screen() !== "hub" }} ref={host} />;
}
