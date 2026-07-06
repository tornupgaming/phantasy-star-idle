/**
 * Pioneer 2 hub screen (pso-hud-menus): floating corner-anchored HUD windows
 * over the persistent scene layer — player HUD capsule + XP/economy side
 * panel, nav window, the active pane's window(s) + detail window, and the
 * shopkeeper dialogue window along the bottom. Keyboard navigation
 * (ui-navigation) lives here as one document-level listener whose focus
 * state is the kbdMenu signal.
 */

import { For, Match, Show, Switch, createEffect, onCleanup, onMount } from "solid-js";
import { LEVEL_CAP } from "../engine/classes";
import { effectiveStats } from "../engine/character";
import { xpForLevel } from "../engine/progression";
import { useUi } from "./context";
import { Icon, MesetaAmount, PlayerHud, SpriteDefs, WindowBox } from "./components";
import { GuildPane, GearShopPane, ToolShopPane, BankPane, EquipmentPane } from "./panes";
import { itemDisplayName, itemNameClass, PANES, PANE_LABELS, supplyLine } from "./ui-shared";

/**
 * XP/economy side panel beside the capsule (player-hud D5, hub-only): total
 * XP + XP-to-next progress, plus the shared economy that used to live in the
 * top-right money pod.
 */
function SidePanel() {
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

/** Post-run quest report, anchored to the Guild pane (ui-navigation D2). */
function ReportBanner() {
  const ui = useUi();
  const r = () => ui.state.lastReport!;
  return (
    <div class={`report ${r().outcome}`}>
      <h2 class={`outcome-${r().outcome}`}>
        {r().outcome === "complete" ? "Run complete!" : "Ejected!"} — {r().characterName}, {r().areaName} (
        {r().difficultyLabel})
      </h2>
      <div class="stat-row">
        <span>
          Rooms{" "}
          <b>
            {r().roomsCleared}/{r().totalRooms}
          </b>
        </span>
        <span>
          Meseta <b><MesetaAmount value={r().meseta} /></b>
        </span>
        <span>
          XP{" "}
          <b>
            {r().xpGained}
            {r().levelsGained > 0 ? ` (LEVEL UP → ${r().level}!)` : ""}
          </b>
        </span>
        <span>
          Grinders <b>{r().grinders}</b>
        </span>
      </div>
      <div style="margin-top:6px">
        Kept:{" "}
        <b>
          <Show when={r().items.length > 0} fallback="no gear kept">
            <For each={r().items}>
              {(item, idx) => (
                <>
                  <span class={itemNameClass(item)}>{itemDisplayName(item)}</span>
                  {idx() < r().items.length - 1 ? ", " : ""}
                </>
              )}
            </For>
          </Show>
        </b>
      </div>
      <div class="muted">
        Consumables gained: {supplyLine(r().consumablesGained)} · used: {supplyLine(r().consumablesUsed)}
      </div>
      <div class="row" style="margin-top:10px">
        <button data-action="dismiss-report" onClick={() => ui.setReportDismissed(true)}>
          Close
        </button>
      </div>
    </div>
  );
}

export function HubScreen() {
  const ui = useUi();
  let hudEl!: HTMLDivElement;

  // Keyboard-navigable menus: classic PSO menus plus the Nova shop card
  // stacks, which expose listbox/option semantics instead of menu-row classes.
  const hubMenus = () => Array.from(hudEl.querySelectorAll<HTMLElement>('.pso-menu, [role="listbox"]'));
  const menuRows = (menu: HTMLElement) =>
    Array.from(menu.querySelectorAll<HTMLElement>('.pso-menu-row, [role="option"]'));
  const rowSelected = (row: HTMLElement) =>
    row.classList.contains("selected") || row.getAttribute("aria-selected") === "true";

  // Keyboard focus indicator: derived from the kbdMenu signal. Menu DOM nodes
  // persist across fine-grained updates, so there is no restoration pass —
  // this effect only runs when focus or pane actually changes.
  createEffect(() => {
    ui.kbdMenu();
    ui.pane();
    const menus = hubMenus();
    if (!menus.length) return;
    const idx = Math.min(ui.kbdMenu(), menus.length - 1);
    menus.forEach((m, i) => m.classList.toggle("kbd-active", i === idx));
  });

  const onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;

    // Any key first completes an in-progress dialogue reveal.
    if (!ui.dlg.done()) {
      ui.dlg.skip();
      if (e.key === "Enter") return;
    }

    // Digit shortcuts jump straight to a nav entry (7 = Change Character).
    if (/^[1-7]$/.test(e.key)) {
      const idx = Number(e.key) - 1;
      if (idx < PANES.length) ui.setPane(PANES[idx]);
      else ui.goto("select");
      e.preventDefault();
      return;
    }

    const menus = hubMenus();
    if (!menus.length) return;
    const cur = Math.min(ui.kbdMenu(), menus.length - 1);

    switch (e.key) {
      case "ArrowRight":
        ui.setKbdMenu(Math.min(menus.length - 1, cur + 1));
        e.preventDefault();
        break;
      case "ArrowLeft":
      case "Escape":
        // Step back one level: candidates → slots → nav.
        ui.setKbdMenu(Math.max(0, cur - 1));
        e.preventDefault();
        break;
      case "ArrowUp":
      case "ArrowDown": {
        const rows = menuRows(menus[cur]);
        if (!rows.length) break;
        const at = rows.findIndex(rowSelected);
        const next =
          at < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
        if (next !== at) rows[next].click();
        e.preventDefault();
        break;
      }
      case "Enter": {
        // Confirm: the pane's primary action (Buy / Equip / Accept Quest / Remove).
        const primary = hudEl.querySelector<HTMLElement>(
          ".hud-detail .primary:not([disabled]), .hud-pane .primary:not([disabled])",
        );
        primary?.click();
        e.preventDefault();
        break;
      }
    }
  };

  onMount(() => {
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
  });

  return (
    <>
      <SpriteDefs />
      <Show when={ui.pane() === "guild" && ui.state.lastReport && !ui.reportDismissed()}>
        <div class="dialog-scrim">
          <ReportBanner />
        </div>
      </Show>
      <div class="hud" ref={hudEl}>
        <div class="hud-status">
          <PlayerHud
            name={ui.selectedChar().name}
            level={ui.selectedChar().level}
            sectionId={ui.selectedChar().sectionId}
            hp={effectiveStats(ui.selectedChar()).hp}
            maxHp={effectiveStats(ui.selectedChar()).hp}
          />
          <SidePanel />
        </div>
        <nav class="hud-nav">
          <WindowBox title="Pioneer 2">
            <div class="pso-menu">
              <For each={PANES}>
                {(p, i) => (
                  <button
                    class="pso-menu-row"
                    classList={{ selected: p === ui.pane() }}
                    data-action="pane"
                    data-pane={p}
                    onClick={() => ui.setPane(p)}
                  >
                    <span class="nav-num">{i() + 1}</span>
                    <span style="flex:1">{PANE_LABELS[p]}</span>
                  </button>
                )}
              </For>
              <button class="pso-menu-row" data-action="goto" data-screen="select" onClick={() => ui.goto("select")}>
                <span class="nav-num">7</span>
                <span style="flex:1">Change Character</span>
              </button>
            </div>
          </WindowBox>
        </nav>
        <Switch>
          <Match when={ui.pane() === "guild"}>
            <GuildPane />
          </Match>
          <Match when={ui.pane() === "weapon-shop"}>
            <GearShopPane kind="weapon" />
          </Match>
          <Match when={ui.pane() === "armour-shop"}>
            <GearShopPane kind="armour" />
          </Match>
          <Match when={ui.pane() === "tool-shop"}>
            <ToolShopPane />
          </Match>
          <Match when={ui.pane() === "equipment"}>
            <EquipmentPane />
          </Match>
          <Match when={ui.pane() === "bank"}>
            <BankPane />
          </Match>
        </Switch>
        <div class="hud-dialogue">
          <div class="pso-window dialogue-window" data-action="dlg-skip" onClick={() => ui.dlg.skip()}>
            <div class="dlg-text">{ui.dlg.visible()}</div>
          </div>
        </div>
      </div>
    </>
  );
}
