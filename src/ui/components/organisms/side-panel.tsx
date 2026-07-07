import { LEVEL_CAP } from "../../../engine/classes";
import { xpForLevel } from "../../../engine/progression";
import { useUi } from "../../context";
import { Icon } from "../atoms/icon";
import { MesetaAmount } from "../molecules/meseta-amount";
import chrome from "../chrome.module.css";

/**
 * XP/economy side panel beside the capsule (player-hud D5, hub-only): total
 * XP + XP-to-next progress, plus the shared economy that used to live in the
 * top-right money pod.
 */
export function SidePanel() {
  const ui = useUi();
  const c = () => ui.selectedChar();
  const atCap = () => c().level >= LEVEL_CAP;
  const cur = () => xpForLevel(c().classId, c().level);
  const next = () => (atCap() ? cur() : xpForLevel(c().classId, c().level + 1));
  const pct = () =>
    atCap() || next() <= cur() ? 100 : Math.min(100, Math.max(0, ((c().xp - cur()) / (next() - cur())) * 100));
  return (
    <div class={`${chrome.surface} px-4 py-2 rounded-[6px_18px_6px_12px] min-w-[250px]`}>
      <div class="text-muted text-[11.5px]">
        Total Exp <b>{c().xp}pt</b> · To Next Lv <b>{atCap() ? "— max —" : `${next() - c().xp}pt`}</b>
      </div>
      <div class="xp-bar">
        <span style={{ width: `${pct().toFixed(1)}%` }}></span>
      </div>
      <div class="flex items-center gap-4 font-semibold whitespace-nowrap [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5">
        <span class="text-gold">
          <MesetaAmount value={ui.state.economy.meseta} />
        </span>
        <span class="text-muted">
          <Icon id="grinder" /> {ui.state.economy.grinders} grinders
        </span>
      </div>
    </div>
  );
}
