/**
 * Gear shop counters (weapon / armour): Nova card stock list + detail window
 * with stat preview and Buy.
 */

import { For, Show } from "solid-js";
import { unitCapacity } from "../../../engine/character";
import { isUnit, type Item } from "../../../engine/items";
import { priceForItem } from "../../../engine/pricing";
import { useUi } from "../../context";
import { useEquippedInSlot } from "../../hooks";
import { PANE_LABELS } from "../../ui-shared";
import { Panel } from "../molecules/panel";
import { ShopList } from "../molecules/shop-card";
import { EquippedLine, ItemDetailHead } from "../molecules/item-detail";
import { MesetaAmount } from "../molecules/meseta-amount";
import { ShopListItem } from "./shop-list-item";
import { StatPreview } from "./stat-preview";
import chrome from "../chrome.module.css";

export function GearShopPane(props: { kind: "weapon" | "armour" }) {
  const ui = useUi();
  const equippedInSlot = useEquippedInSlot();
  const stock = () => ui.selectedEntry().shop[props.kind];
  const sel = () => stock().offers.find((o) => o.id === ui.detailId()) ?? null;
  const emptyMsg = () => `Sold out — stock refreshes as ${ui.selectedChar().name} gains levels.`;
  const atUnitCap = (item: Item) =>
    isUnit(item) && ui.selectedChar().equipment.units.length >= unitCapacity(ui.selectedChar().equipment);

  return (
    <>
      <section class="hud-pane">
        <Panel>
          <Panel.Header actions={`${stock().offers.length} in stock`}>
            {PANE_LABELS[props.kind === "weapon" ? "weapon-shop" : "armour-shop"]}
          </Panel.Header>
          <Panel.Body>
            <ShopList>
              <Show when={stock().offers.length > 0} fallback={<div class="text-muted">{emptyMsg()}</div>}>
                <For each={stock().offers}>
                  {(o, i) => (
                    <ShopListItem
                      index={i()}
                      item={o}
                      price={priceForItem(o)}
                      selected={o.id === ui.detailId()}
                      onSelect={() => ui.setDetailId(o.id)}
                    />
                  )}
                </For>
              </Show>
            </ShopList>
          </Panel.Body>
        </Panel>
      </section>
      <aside class="hud-detail">
        <Panel>
          <Panel.Header>Item Info</Panel.Header>
          <Panel.Body>
          <div>
            <Show
              when={sel()}
              fallback={
                <div class="text-muted">{stock().offers.length > 0 ? "Select an item." : emptyMsg()}</div>
              }
            >
              {(item) => (
                <>
                  <ItemDetailHead item={item()} />
                  <Show when={equippedInSlot(item())}>{(cur) => <EquippedLine current={cur()} />}</Show>
                  <h3>If equipped</h3>
                  <Show
                    when={!atUnitCap(item())}
                    fallback={<div class="text-muted">No free unit slot — equip a frame with room first.</div>}
                  >
                    <StatPreview slot={item().kind as "weapon" | "frame" | "barrier" | "unit"} item={item()} />
                  </Show>
                  <div class="flex gap-2 items-center mt-3 mb-1.5 flex-wrap">
                    <span class="text-muted"><MesetaAmount value={priceForItem(item())} /></span>
                    <button
                      class={`primary ${chrome.btnPrimary}`}
                      data-action="buy-gear"
                      data-kind={props.kind}
                      data-id={item().id}
                      onClick={() => {
                        const id = item().id;
                        if (ui.act(() => ui.game.buyGearFromShop(props.kind, id), "bought")) {
                          if (ui.detailId() === id) ui.setDetailId(null);
                        }
                      }}
                    >
                      Buy
                    </button>
                  </div>
                </>
              )}
            </Show>
          </div>
          </Panel.Body>
        </Panel>
      </aside>
    </>
  );
}
