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
import chrome from "../chrome.module.css";

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
      <div class="flex justify-between items-start gap-3 mb-4">
        <PlayerHud
          name={character.name}
          level={character.level}
          sectionId={character.sectionId}
          hp={maxHp}
          maxHp={maxHp}
        />
        <h1>✦ Run in progress</h1>
      </div>
      <div class={`${chrome.surface} rounded-[4px_18px_4px_12px] p-3.5`}>
        <h2>
          {prog.areaName} — {prog.difficultyLabel}
        </h2>
        <div class="stage-minimap my-2.5"></div>
        <div class="flex flex-wrap gap-x-3.5 gap-y-1.5 text-muted [&_b]:text-ink mt-2">
          <span>
            Progress <b class="stage-pct">—</b>
          </span>
          <span>
            Enemies defeated <b class="stage-kills">0</b>
          </span>
          <span class="stage-status muted">Running…</span>
        </div>
      </div>
      <div class={`${chrome.surface} rounded-[4px_18px_4px_12px] p-0 overflow-hidden mt-3.5`}>
        <div class="stage-ticker">…</div>
        <div class="stage-field"></div>
        <div class="flex items-center gap-4 px-3.5 py-3 border-t border-pso-edge-dim bg-[rgba(10,40,52,0.6)] stage-bottom">
          <div class="text-xs stage-side stage-supply muted"></div>
        </div>
      </div>
      <div class={`${chrome.surface} rounded-[4px_18px_4px_12px] p-3.5 mt-3.5`}>
        <h3>Enemy drops</h3>
        <div class="flex flex-wrap gap-1.5 min-h-7 items-center text-[12.5px] stage-loot-tally muted">
          No enemy drops yet.
        </div>
      </div>
      <div class={`${chrome.surface} rounded-[4px_18px_4px_12px] p-3.5 mt-3.5`}>
        <h3>Battle log</h3>
        <div class="log log-compact stage-log"></div>
      </div>
    </div>
  );
}
