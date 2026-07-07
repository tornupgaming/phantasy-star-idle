import { LEVEL_CAP } from "../../../engine/classes";
import { xpForLevel } from "../../../engine/progression";
import { useUi } from "../../context";
import { Icon } from "../atoms/icon";
import { MesetaAmount } from "../molecules/meseta-amount";

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
    <div class="pso-window hud-side-panel">
      <div class="muted small">
        Total Exp <b>{c().xp}pt</b> · To Next Lv <b>{atCap() ? "— max —" : `${next() - c().xp}pt`}</b>
      </div>
      <div class="xp-bar">
        <span style={{ width: `${pct().toFixed(1)}%` }}></span>
      </div>
      <div class="side-economy">
        <span class="meseta">
          <MesetaAmount value={ui.state.economy.meseta} />
        </span>
        <span class="muted">
          <Icon id="grinder" /> {ui.state.economy.grinders} grinders
        </span>
      </div>
    </div>
  );
}
