import { Show } from "solid-js";
import type { SectionId } from "../../../engine/classes";
import { sectionIcon } from "../../icons";
import { Icon } from "../atoms/icon";
import { MesetaAmount } from "./meseta-amount";
import chrome from "../chrome.module.css";
import styles from "./player-hud.module.css";

/**
 * PSO player HUD capsule (player-hud spec): hex character icon with the
 * Photon Blast badge, HP/TP bars with right-aligned numbers, Lv pill, and the
 * yellow name plate with section ID glyph. One component, two regimes: the
 * hub feeds it reactive props; the run shell renders it once and BattleStage
 * then drives the `stage-char-hp` / `stage-char-hp-text` hooks and the
 * hurt/healed flashes on the `player-hud` root imperatively. The TP row and
 * PB badge are the authentic empty states (`0/0`, badge `0`) — real elements
 * a future techniques/Photon Blast system will drive, not throwaway markup.
 * The hub additionally feeds `meseta` (beside the name plate) and `xpPct`
 * (the XP bar trailing the Lv pill); the run shell omits both.
 */
export function PlayerHud(props: {
  name: string;
  level: number;
  sectionId: SectionId;
  hp: number;
  maxHp: number;
  meseta?: number;
  xpPct?: number;
}) {
  const pct = () => (props.maxHp > 0 ? (props.hp / props.maxHp) * 100 : 0);
  return (
    <div
      class={`player-hud ${chrome.surface} relative flex items-center ml-[26px] mb-3 pt-[9px] pr-[18px] pb-[11px] pl-9 min-w-[280px] rounded-[28px]`}
    >
      <div class="absolute -left-[26px] top-1/2 -translate-y-1/2 w-14 h-[50px]">
        <div
          class={`${styles.hexFace} w-full h-full flex items-center justify-center overflow-hidden text-[#bfeef8]`}
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            class="w-[30px] h-[30px] mt-2 [filter:drop-shadow(0_0_4px_var(--color-pso-glow))]"
          >
            <circle cx="8" cy="5.4" r="3.1" fill="currentColor" />
            <path d="M2.5 15.5a5.5 5 0 0 1 11 0z" fill="currentColor" />
          </svg>
        </div>
        <span class="absolute -top-1 -right-[3px] w-[17px] h-[17px] rounded-full bg-[#04141c] border border-pso-edge text-accent text-[10px] font-bold leading-[15px] text-center">
          0
        </span>
      </div>
      <div class="flex-1 min-w-0 flex flex-col gap-[3px]">
        <div class="flex items-center gap-2">
          <span class="flex-none w-5 text-[10px] font-bold tracking-[1px] text-accent">HP</span>
          <div class="hpbar flex-1 h-[10px]">
            <span class="stage-char-hp" style={{ width: `${pct()}%` }}></span>
          </div>
          <span class="stage-char-hp-text flex-none w-16 text-right text-[11.5px] font-semibold [font-variant-numeric:tabular-nums] whitespace-nowrap">
            {props.hp}/{props.maxHp}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="flex-none w-5 text-[10px] font-bold tracking-[1px] text-accent">TP</span>
          <div class="hpbar tpbar flex-1 h-[10px]">
            <span style="width:0%"></span>
          </div>
          <span class="flex-none w-16 text-right text-[11.5px] font-semibold [font-variant-numeric:tabular-nums] whitespace-nowrap">
            0/0
          </span>
        </div>
        <div class="flex items-center justify-end gap-1.5 mt-px">
          <Show when={props.meseta !== undefined}>
            <span class="mr-auto text-gold text-[12.5px] font-semibold">
              <MesetaAmount value={props.meseta!} />
            </span>
          </Show>
          <Icon id={sectionIcon(props.sectionId)} />
          <span class="text-gold text-[13.5px] font-bold tracking-[0.5px] overflow-hidden text-ellipsis whitespace-nowrap">
            {props.name}
          </span>
        </div>
      </div>
      <div class="absolute left-4 right-[18px] -bottom-[11px] flex items-center gap-2">
        <span
          class={`${styles.lvPill} flex-none px-3 py-px rounded-[10px] text-[#bfeef8] text-[10px] tracking-[0.5px]`}
        >
          Lv <b class="text-xs text-[#eafcff] [text-shadow:0_0_6px_var(--color-pso-glow)]">{props.level}</b>
        </span>
        <Show when={props.xpPct !== undefined}>
          <div class="xp-bar flex-1">
            <span style={{ width: `${props.xpPct!.toFixed(1)}%` }}></span>
          </div>
        </Show>
      </div>
    </div>
  );
}
