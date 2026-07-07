/**
 * Layout for the full-page menu screens (select/create): sprite defs, topbar
 * with the shared economy readout, the notice line, then the page content.
 */

import type { JSX } from "solid-js";
import { useUi } from "../../context";
import type { Screen } from "../../ui-shared";
import { SpriteDefs } from "../atoms/sprite-defs";
import { Topbar } from "../organisms/topbar";

export function MenuScreenLayout(props: {
  title: string;
  back?: { label: string; screen: Screen };
  children: JSX.Element;
}) {
  const ui = useUi();
  return (
    <>
      <SpriteDefs />
      <Topbar title={props.title} back={props.back} />
      <div class="notice">{ui.notice()}</div>
      {props.children}
    </>
  );
}
