import { useUi } from "../../context";
import styles from "./dialogue-window.module.css";

/** Shopkeeper dialogue window along the hub's bottom edge; click to skip the reveal. */
export function DialogueWindow() {
  const ui = useUi();
  return (
    <div
      class={`dialogue-window ${styles.window} px-[18px] pr-10 py-2.5 min-h-[44px] cursor-pointer rounded-[14px_20px_14px_14px]`}
      data-action="dlg-skip"
      onClick={() => ui.dlg.skip()}
    >
      <div class="dlg-text text-[13.5px] leading-[1.55] min-h-[21px]">{ui.dlg.visible()}</div>
    </div>
  );
}
