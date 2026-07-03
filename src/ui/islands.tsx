/**
 * Imperative islands (convert-menu-ui-to-solidjs D3). Solid mounts the
 * container and owns the lifecycle; the Backdrop's canvas loop and the
 * BattleStage's rAF event playback stay fully imperative and are never
 * reactively rendered into.
 */

import { createEffect, onCleanup, onMount } from "solid-js";
import { BattleStage } from "./stage";
import { Backdrop } from "./backdrop";
import { useUi } from "./context";

/**
 * Persistent hub scene layer. The canvas element survives pane changes and
 * screen changes (hidden, not unmounted, off-hub per hub-scene-backdrop);
 * only the theme is forwarded reactively.
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

/**
 * Run-screen island: the static shell markup (every element the BattleStage
 * updates carries a class hook), rendered once per run — shell values are
 * deliberately read non-reactively at mount. The stage owns all dynamic
 * updates from here (battle-scene-view D3/D4).
 */
export function StageIsland() {
  const ui = useUi();
  // Read once: the shell is static by design; the stage repaints the rest.
  const g = ui.game.state;
  const prog = ui.game.runProgress()!;
  const character = g.activeRun!.input.character;

  let host!: HTMLDivElement;
  onMount(() => {
    const stage = new BattleStage(host, ui.game);
    stage.start();
    onCleanup(() => stage.stop());
  });

  return (
    <div class="run-screen" ref={host}>
      <div class="topbar">
        <h1>✦ Run in progress</h1>
        <div class="resources">
          <span class="meseta">{g.economy.meseta} meseta</span>
        </div>
      </div>
      <div class="panel">
        <h2>
          {prog.areaName} — {prog.difficultyLabel}
        </h2>
        <div class="rooms stage-rooms"></div>
        <div class="progress">
          <span class="stage-progress"></span>
        </div>
        <div class="stat-row" style="margin-top:8px">
          <span>
            Progress <b class="stage-pct">0%</b>
          </span>
          <span>
            Enemies defeated <b class="stage-kills">0</b>
          </span>
          <span class="stage-status muted">Running…</span>
        </div>
      </div>
      <div class="panel stage" style="margin-top:14px">
        <div class="stage-ticker">…</div>
        <div class="stage-field"></div>
        <div class="stage-bottom">
          <div class="stage-player-box">
            <div class="stage-player-head">
              <b>{character.name}</b>
              <span class="stage-room-label muted">—</span>
            </div>
            <div class="hpbar hp-char">
              <span class="stage-char-hp"></span>
            </div>
            <div class="stage-char-hp-text muted"></div>
          </div>
          <div class="stage-side stage-supply muted"></div>
        </div>
      </div>
      <div class="panel" style="margin-top:14px">
        <h3>Battle log</h3>
        <div class="log log-compact stage-log"></div>
      </div>
    </div>
  );
}
