/** Shared inventory/bank: item list window + detail window with Equip/Sell. */

import { For, Show } from "solid-js";
import { sellPrice } from "../../../engine/pricing";
import { useUi } from "../../context";
import { useEquippedInSlot } from "../../hooks";
import { WindowBox } from "../molecules/window-box";
import { ItemRow } from "../molecules/item-row";
import { EquippedLine, ItemDetailHead } from "../molecules/item-detail";
import { MesetaAmount } from "../molecules/meseta-amount";

export function BankPane() {
  const ui = useUi();
  const equippedInSlot = useEquippedInSlot();
  const inv = () => ui.state.economy.inventory;
  const sel = () => inv().find((i) => i.id === ui.detailId()) ?? inv()[0] ?? null;
  const emptyMsg = "Inventory empty — send a run to find gear.";

  return (
    <>
      <section class="hud-pane">
        <WindowBox title="Inventory/Bank" trailing={`${inv().length} items`}>
          <div class="pso-menu shop-list">
            <Show when={inv().length > 0} fallback={<div class="muted">{emptyMsg}</div>}>
              <For each={inv()}>
                {(i) => (
                  <ItemRow
                    item={i}
                    trailing={<MesetaAmount value={sellPrice(i)} />}
                    selected={i.id === ui.detailId()}
                    onSelect={() => ui.setDetailId(i.id)}
                  />
                )}
              </For>
            </Show>
          </div>
        </WindowBox>
      </section>
      <aside class="hud-detail">
        <WindowBox title="Item Info">
          <div class="shop-detail">
            <Show when={sel()} fallback={<div class="muted">{emptyMsg}</div>}>
              {(item) => (
                <>
                  <ItemDetailHead item={item()} />
                  <Show when={equippedInSlot(item())}>{(cur) => <EquippedLine current={cur()} />}</Show>
                  <div class="row" style="margin-top:12px">
                    <Show when={item().kind !== "tool"}>
                      <button
                        class="primary"
                        data-action="equip"
                        data-id={item().id}
                        onClick={() => {
                          const id = item().id;
                          if (ui.act(() => ui.game.equipFromInventory(id), "equipped")) ui.setEquipCand(null);
                        }}
                      >
                        Equip
                      </button>
                    </Show>
                    <button
                      data-action="sell"
                      data-id={item().id}
                      onClick={() => {
                        const id = item().id;
                        if (ui.act(() => ui.game.sellInventoryItem(id), "sold")) {
                          if (ui.detailId() === id) ui.setDetailId(null);
                        }
                      }}
                    >
                      Sell (<MesetaAmount value={sellPrice(item())} />)
                    </button>
                  </div>
                </>
              )}
            </Show>
          </div>
        </WindowBox>
      </aside>
    </>
  );
}
