/**
 * Tool shop counter: consumables/grinders/tool items as Nova cards, with the
 * per-offer detail window (Buy 1 / Buy 5 / Buy 10 flows).
 */

import { For, Match, Switch } from "solid-js";
import { priceForItem } from "../../../engine/pricing";
import { GRINDER_PRICE, type ToolOffer } from "../../../engine/shop";
import { CONSUMABLES, CONSUMABLES_LIST, type ConsumableId } from "../../../engine/consumables";
import { flavor } from "../../dialogue";
import { iconForKind } from "../../icons";
import { useUi } from "../../context";
import { Icon, KindIcon } from "../atoms/icon";
import { Panel } from "../molecules/panel";
import { ShopCard, ShopList } from "../molecules/shop-card";
import { ItemDetailHead } from "../molecules/item-detail";
import { MesetaAmount } from "../molecules/meseta-amount";
import { ShopListItem } from "./shop-list-item";
import chrome from "../chrome.module.css";

export function ToolShopPane() {
  const ui = useUi();
  const stock = () => ui.game.toolShopStock();
  const selCons = () => CONSUMABLES_LIST.find((c) => c.id === ui.detailId());
  const selToolItem = () => {
    const offer = stock().offers.find((o) => o.type === "item" && o.item.id === ui.detailId());
    return offer ? (offer as Extract<ToolOffer, { type: "item" }>).item : undefined;
  };

  return (
    <>
      <section class="hud-pane">
        <Panel>
          <Panel.Header actions={`${stock().offers.length} in stock`}>Tool Shop</Panel.Header>
          <Panel.Body>
          <ShopList>
            <For each={stock().offers}>
              {(offer, i) => {
                if (offer.type === "consumable") {
                  const c = CONSUMABLES[offer.id];
                  return (
                    <ShopCard
                      index={i()}
                      selected={c.id === ui.detailId()}
                      onSelect={() => ui.setDetailId(c.id)}
                      dataId={c.id}
                      icon={iconForKind(c.kind)}
                      rarityClass="rarity-common"
                      name={<span class="name">{c.name}</span>}
                      sub={
                        c.kind === "heal"
                          ? `Restores ${c.amount} HP during a run`
                          : c.kind === "revive"
                            ? "Revives once when defeated"
                            : "No use yet — system offline"
                      }
                      price={c.price}
                    />
                  );
                }
                if (offer.type === "grinder") {
                  return (
                    <ShopCard
                      index={i()}
                      selected={ui.detailId() === "grinder"}
                      onSelect={() => ui.setDetailId("grinder")}
                      dataId="grinder"
                      icon="grinder"
                      rarityClass="rarity-common"
                      name={<span class="name">Grinder</span>}
                      sub="Raises a weapon's grind by 1"
                      price={GRINDER_PRICE}
                    />
                  );
                }
                return (
                  <ShopListItem
                    index={i()}
                    item={offer.item}
                    price={priceForItem(offer.item)}
                    selected={offer.item.id === ui.detailId()}
                    onSelect={() => ui.setDetailId(offer.item.id)}
                  />
                );
              }}
            </For>
          </ShopList>
          </Panel.Body>
        </Panel>
      </section>
      <aside class="hud-detail">
        <Panel>
          <Panel.Header>Item Info</Panel.Header>
          <Panel.Body>
          <div>
            <Switch fallback={<div class="text-muted">Select an item.</div>}>
              <Match when={ui.detailId() === "grinder"}>
                <div class="text-base font-bold text-accent mb-0.5">
                  <Icon id="grinder" /> Grinder
                </div>
                <div class="italic text-[#bcd8e0] text-[12.5px] mt-0.5 mb-1.5">{flavor("Grinder", "grinder")}</div>
                <div class="text-muted text-[11.5px] mb-2">
                  Raises an equipped weapon's grind by 1, up to its cap.
                </div>
                <div class="flex gap-2 items-center mt-3 mb-1.5 flex-wrap">
                  <span class="text-muted"><MesetaAmount value={GRINDER_PRICE} suffix="each" /></span>
                  <button data-action="buy-grinder" data-qty="1" onClick={() => ui.act(() => ui.game.buyGrinders(1), "bought")}>
                    Buy 1
                  </button>
                  <button data-action="buy-grinder" data-qty="5" onClick={() => ui.act(() => ui.game.buyGrinders(5), "bought")}>
                    Buy 5
                  </button>
                </div>
              </Match>
              <Match when={selToolItem()}>
                {(item) => (
                  <>
                    <ItemDetailHead item={item()} />
                    <div class="text-muted text-[11.5px] mb-2">
                      {item().tech !== undefined
                        ? "A technique disk. No one aboard can learn techniques yet — one day."
                        : "Kept in inventory; no use for it yet."}
                    </div>
                    <div class="flex gap-2 items-center mt-3 mb-1.5 flex-wrap">
                      <span class="text-muted"><MesetaAmount value={priceForItem(item())} /></span>
                      <button
                        class={`primary ${chrome.btnPrimary}`}
                        data-action="buy-tool-item"
                        data-id={item().id}
                        onClick={() => {
                          const id = item().id;
                          if (ui.act(() => ui.game.buyToolItemFromShop(id), "bought")) {
                            if (ui.detailId() === id) ui.setDetailId(null);
                          }
                        }}
                      >
                        Buy
                      </button>
                    </div>
                  </>
                )}
              </Match>
              <Match when={selCons()}>
                {(c) => (
                  <>
                    <div class="text-base font-bold text-accent mb-0.5">
                      <KindIcon kind={c().kind} /> {c().name}
                    </div>
                    <div class="italic text-[#bcd8e0] text-[12.5px] mt-0.5 mb-1.5">{flavor(c().name, c().kind)}</div>
                    <div class="text-muted text-[11.5px] mb-2">
                      {c().kind === "heal"
                        ? `Restores ${c().amount} HP during a run.`
                        : c().kind === "revive"
                          ? "Revives once when defeated during a run."
                          : "No use yet — carried for the day its system comes online."}
                    </div>
                    <div class="flex gap-2 items-center mt-3 mb-1.5 flex-wrap">
                      <span class="text-muted"><MesetaAmount value={c().price} suffix="each" /></span>
                      <button
                        data-action="buy"
                        data-id={c().id}
                        data-qty="1"
                        onClick={() => ui.act(() => ui.game.buyConsumable(c().id as ConsumableId, 1), "bought")}
                      >
                        Buy 1
                      </button>
                      <button
                        data-action="buy"
                        data-id={c().id}
                        data-qty="10"
                        onClick={() => ui.act(() => ui.game.buyConsumable(c().id as ConsumableId, 10), "bought")}
                      >
                        Buy 10
                      </button>
                    </div>
                  </>
                )}
              </Match>
            </Switch>
          </div>
          </Panel.Body>
        </Panel>
      </aside>
    </>
  );
}
