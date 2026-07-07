/**
 * Pioneer 2 hub grid (pso-hud-menus): floating corner-anchored HUD windows
 * over the persistent scene layer — status corner (HUD capsule + side panel),
 * nav window, the active pane's window(s) + detail window (children), and the
 * dialogue window along the bottom. Pure arrangement; behavior (keyboard
 * navigation, pane switching) belongs to the hub page.
 */

import type { JSX } from "solid-js";
import { SpriteDefs } from "../atoms/sprite-defs";

export function HubLayout(props: {
  ref?: (el: HTMLDivElement) => void;
  status: JSX.Element;
  nav: JSX.Element;
  dialogue: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <>
      <SpriteDefs />
      <div class="hud" ref={props.ref}>
        <div class="hud-status">{props.status}</div>
        <nav class="hud-nav">{props.nav}</nav>
        {props.children}
        <div class="hud-dialogue">{props.dialogue}</div>
      </div>
    </>
  );
}
