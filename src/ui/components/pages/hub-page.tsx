/**
 * Pioneer 2 hub screen (pso-hud-menus): the HubLayout template filled with
 * the status organisms, nav, the active pane's window(s), and the shopkeeper
 * dialogue. Keyboard navigation (ui-navigation) lives here as one
 * document-level listener whose focus state is the kbdMenu signal.
 */

import { Match, Show, Switch, createEffect, onCleanup, onMount } from "solid-js";
import { effectiveStats } from "../../../engine/character";
import { useUi } from "../../context";
import { PANES } from "../../ui-shared";
import { PlayerHud } from "../molecules/player-hud";
import { SidePanel } from "../organisms/side-panel";
import { ReportBanner } from "../organisms/report-banner";
import { HubNav } from "../organisms/hub-nav";
import { DialogueWindow } from "../organisms/dialogue-window";
import { GuildPane } from "../organisms/guild-pane";
import { GearShopPane } from "../organisms/gear-shop-pane";
import { ToolShopPane } from "../organisms/tool-shop-pane";
import { BankPane } from "../organisms/bank-pane";
import { EquipmentPane } from "../organisms/equipment-pane";
import { HubLayout } from "../templates/hub-layout";

export function HubPage() {
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
      <Show when={ui.pane() === "guild" && ui.state.lastReport && !ui.reportDismissed()}>
        <div class="dialog-scrim">
          <ReportBanner />
        </div>
      </Show>
      <HubLayout
        ref={(el) => (hudEl = el)}
        status={
          <>
            <PlayerHud
              name={ui.selectedChar().name}
              level={ui.selectedChar().level}
              sectionId={ui.selectedChar().sectionId}
              hp={effectiveStats(ui.selectedChar()).hp}
              maxHp={effectiveStats(ui.selectedChar()).hp}
            />
            <SidePanel />
          </>
        }
        nav={<HubNav />}
        dialogue={<DialogueWindow />}
      >
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
      </HubLayout>
    </>
  );
}
