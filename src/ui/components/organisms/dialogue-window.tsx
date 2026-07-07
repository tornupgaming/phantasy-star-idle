import { useUi } from "../../context";

/** Shopkeeper dialogue window along the hub's bottom edge; click to skip the reveal. */
export function DialogueWindow() {
  const ui = useUi();
  return (
    <div class="pso-window dialogue-window" data-action="dlg-skip" onClick={() => ui.dlg.skip()}>
      <div class="dlg-text">{ui.dlg.visible()}</div>
    </div>
  );
}
