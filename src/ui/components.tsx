/**
 * Small shared presentational components for the menu screens: SVG icon
 * sprite plumbing (item-iconography), the tabbed HUD window frame
 * (pso-visual-theme), the select/create topbar, and the PSO-style stat
 * preview table used by shops and the equipment pane.
 */

import { For, Show, type JSX } from "solid-js";
import {
  effectiveStats,
  equipmentAtp,
  previewEquipment,
  type Character,
} from "../engine/character";
import { weaponAvoidancePct } from "../engine/data/avoidance";
import { weaponKindOf, type Item, type Weapon } from "../engine/items";
import type { SectionId } from "../engine/classes";
import { iconForKind, sectionIcon, spriteDefs, type IconId } from "./icons";
import { useUi } from "./context";
import mesetaIconUrl from "./assets/meseta_icon.png";
import type { Screen } from "./ui-shared";

export function Icon(props: { id: IconId }) {
  return (
    <svg class="icon" aria-hidden="true">
      <use href={`#i-${props.id}`} />
    </svg>
  );
}

export function KindIcon(props: { kind: string }) {
  return <Icon id={iconForKind(props.kind)} />;
}

export function MesetaIcon() {
  return <img class="meseta-icon" src={mesetaIconUrl} alt="Meseta" />;
}

export function MesetaAmount(props: { value: number; suffix?: JSX.Element | string }) {
  return (
    <span class="meseta-amount" aria-label={`${props.value} meseta`}>
      <span>{props.value}</span>
      <MesetaIcon />
      <Show when={props.suffix}>{(suffix) => <span>{suffix()}</span>}</Show>
    </span>
  );
}

/** Hidden <symbol> sprite sheet; rows reference glyphs with <use>. */
export function SpriteDefs() {
  return <span style="display:none" innerHTML={spriteDefs()} />;
}

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

/**
 * A named HUD window: orange tab header (title + optional trailing meta)
 * overlapping a pso-window body (pso-visual-theme "tab header" requirement).
 */
export function WindowBox(props: { title: string; trailing?: string; children: JSX.Element }) {
  return (
    <section class="pso-window win">
      <div class="pso-tab">
        <span class="tab-title">{props.title}</span>
        <Show when={props.trailing}>
          <span class="tab-meta">{props.trailing}</span>
        </Show>
      </div>
      <div class="win-body">{props.children}</div>
    </section>
  );
}

/** Select/create screens' top bar with the shared economy readout. */
export function Topbar(props: { title: string; back?: { label: string; screen: Screen } }) {
  const ui = useUi();
  return (
    <div class="topbar">
      <h1>
        <Show when={props.back}>
          {(back) => (
            <button class="small" data-action="goto" data-screen={back().screen} onClick={() => ui.goto(back().screen)}>
              ◀ {back().label}
            </button>
          )}
        </Show>{" "}
        ✦ {props.title}
      </h1>
      <div class="resources">
        <span class="meseta"><MesetaAmount value={ui.state.economy.meseta} /></span>
        <span>{ui.state.economy.grinders} grinders</span>
      </div>
    </div>
  );
}

/**
 * PSO-style stat preview: current effective stats vs. as-if the change were
 * made, with ▲/▼ change markers. Displayed ATP folds in the equipment's
 * EQATP contribution (as PSO's status window does) so weapon comparisons are
 * meaningful — effectiveStats alone carries weapon ATP via the damage
 * formula, not the stat block.
 */
/** Weapon avoidance (weapon-range-avoidance); `null` is barehanded (fist). */
export function weaponAvd(weapon: Weapon | null): number {
  return weaponAvoidancePct(weaponKindOf(weapon));
}

export function StatPreview(props: {
  slot: "weapon" | "frame" | "barrier" | "unit";
  item: Item | null;
  removeUnitId?: string;
}) {
  const ui = useUi();
  const rows = (): Array<[string, number, number]> => {
    const character = ui.selectedChar();
    const cur = effectiveStats(character);
    const nextEq = previewEquipment(character, props.slot, props.item as never, props.removeUnitId);
    const next = effectiveStats({ ...character, equipment: nextEq } as Character);
    const out: Array<[string, number, number]> = [
      ["ATP", cur.atp + Math.floor(equipmentAtp(character.equipment)), next.atp + Math.floor(equipmentAtp(nextEq))],
      ["DFP", cur.dfp, next.dfp],
      ["ATA", cur.ata, next.ata],
      ["EVP", cur.evp, next.evp],
      ["LCK", cur.lck, next.lck],
      ["HP", cur.hp, next.hp],
    ];
    if (props.slot === "weapon") {
      out.push(["AVD%", weaponAvd(character.equipment.weapon), weaponAvd(nextEq.weapon)]);
    }
    return out;
  };
  return (
    <table class="diff-table">
      <tbody>
        <tr>
          <th></th>
          <th class="muted">now</th>
          <th class="muted">after</th>
        </tr>
        <For each={rows()}>
          {([label, a, b]) => (
            <tr>
              <th>{label}</th>
              <td>{a}</td>
              <td class={b > a ? "diff-up" : b < a ? "diff-down" : "diff-same"}>
                {b} {b > a ? "▲" : b < a ? "▼" : ""}
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
