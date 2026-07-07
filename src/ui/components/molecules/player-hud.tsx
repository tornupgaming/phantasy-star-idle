import type { SectionId } from "../../../engine/classes";
import { sectionIcon } from "../../icons";
import { Icon } from "../atoms/icon";

/**
 * PSO player HUD capsule (player-hud spec): hex character icon with the
 * Photon Blast badge, HP/TP bars with right-aligned numbers, Lv pill, and the
 * yellow name plate with section ID glyph. One component, two regimes: the
 * hub feeds it reactive props; the run shell renders it once and BattleStage
 * then drives the `stage-char-hp` / `stage-char-hp-text` hooks and the
 * hurt/healed flashes on the `player-hud` root imperatively. The TP row and
 * PB badge are the authentic empty states (`0/0`, badge `0`) — real elements
 * a future techniques/Photon Blast system will drive, not throwaway markup.
 */
export function PlayerHud(props: {
  name: string;
  level: number;
  sectionId: SectionId;
  hp: number;
  maxHp: number;
}) {
  const pct = () => (props.maxHp > 0 ? (props.hp / props.maxHp) * 100 : 0);
  return (
    <div class="player-hud">
      <div class="hud-hex">
        <div class="hud-hex-face">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="5.4" r="3.1" fill="currentColor" />
            <path d="M2.5 15.5a5.5 5 0 0 1 11 0z" fill="currentColor" />
          </svg>
        </div>
        <span class="hud-pb-badge">0</span>
      </div>
      <div class="hud-rows">
        <div class="hud-bar-row">
          <span class="hud-bar-label">HP</span>
          <div class="hpbar">
            <span class="stage-char-hp" style={{ width: `${pct()}%` }}></span>
          </div>
          <span class="hud-bar-num stage-char-hp-text">
            {props.hp}/{props.maxHp}
          </span>
        </div>
        <div class="hud-bar-row">
          <span class="hud-bar-label">TP</span>
          <div class="hpbar tpbar">
            <span style="width:0%"></span>
          </div>
          <span class="hud-bar-num">0/0</span>
        </div>
        <div class="hud-name-row">
          <Icon id={sectionIcon(props.sectionId)} />
          <span class="hud-name">{props.name}</span>
        </div>
      </div>
      <span class="hud-lv-pill">
        Lv <b>{props.level}</b>
      </span>
    </div>
  );
}
