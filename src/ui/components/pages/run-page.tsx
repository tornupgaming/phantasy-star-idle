/**
 * Run screen (imperative island, convert-menu-ui-to-solidjs D3): the static
 * shell markup (every element the BattleStage updates carries a class hook),
 * rendered once per run — shell values are deliberately read non-reactively
 * at mount. The stage owns all dynamic updates from here (battle-scene-view
 * D3/D4); Solid only mounts the container and owns the lifecycle.
 */

import { onCleanup, onMount } from "solid-js";
import { effectiveStats } from "../../../engine/character";
import { BattleStage } from "../../stage";
import { useUi } from "../../context";
import { SpriteDefs } from "../atoms/sprite-defs";
import { PlayerHud } from "../molecules/player-hud";

export function RunPage() {
  const ui = useUi();
  // Read once: the shell is static by design; the stage repaints the rest.
  const g = ui.game.state;
  const prog = ui.game.runProgress()!;
  const character = g.activeRun!.input.character;
  const maxHp = effectiveStats(character).hp;

  let host!: HTMLDivElement;
  onMount(() => {
    const stage = new BattleStage(host, ui.game);
    stage.start();
    onCleanup(() => stage.stop());
  });

  return (
    <div class="run-screen" ref={host}>
      <SpriteDefs />
      <div class="topbar run-topbar">
        <PlayerHud
          name={character.name}
          level={character.level}
          sectionId={character.sectionId}
          hp={maxHp}
          maxHp={maxHp}
        />
        <h1>✦ Run in progress</h1>
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
            Progress <b class="stage-pct">—</b>
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
          <div class="stage-side stage-supply muted"></div>
        </div>
      </div>
      <div class="panel" style="margin-top:14px">
        <h3>Enemy drops</h3>
        <div class="stage-loot-tally muted">No enemy drops yet.</div>
      </div>
      <div class="panel" style="margin-top:14px">
        <h3>Battle log</h3>
        <div class="log log-compact stage-log"></div>
      </div>
    </div>
  );
}
