/**
 * Pioneer 2 hub panes (pso-hud-menus): Hunter's Guild quest counter, the gear
 * and tool shop counters (list window + detail window), the shared
 * inventory/bank, and the PSO-style equipment flow (slot → candidates →
 * preview → equip). Each pane renders its `.hud-pane` window(s) plus its
 * `.hud-detail` window as siblings in the hub grid.
 */

import { For, Show, Switch, Match, type JSX } from "solid-js";
import { AREA_LIST } from "../engine/content";
import { DIFFICULTIES, type DifficultyId } from "../engine/areas";
import { unitCapacity } from "../engine/character";
import { isUnit, type Item } from "../engine/items";
import { priceForItem, sellPrice } from "../engine/pricing";
import { GRINDER_PRICE, type ToolOffer } from "../engine/shop";
import { CONSUMABLES, CONSUMABLES_LIST, type ConsumableId } from "../engine/consumables";
import { flavor, itemFlavor } from "./dialogue";
import { useUi } from "./context";
import { Icon, KindIcon, StatPreview, WindowBox } from "./components";
import {
  PANE_LABELS,
  PATTERN_PRESETS,
  SLOT_ICONS,
  itemMeta,
  patternMeta,
  patternName,
  supplyLine,
  type EquipSlot,
} from "./ui-shared";

// ---- Hunter's Guild (quest counter, menu idioms — no form controls) ---------

export function GuildPane() {
  const ui = useUi();
  let filterBelow!: HTMLInputElement;
  let filterKeepRare!: HTMLInputElement;

  return (
    <>
      <section class="hud-pane">
        <WindowBox title="Hunter's Guild" trailing="Quest Counter">
          <h3>Area</h3>
          <div class="pso-menu">
            <For each={AREA_LIST}>
              {(a) => (
                <button
                  class="pso-menu-row"
                  classList={{ selected: a.id === ui.areaSel() }}
                  data-action="area"
                  data-id={a.id}
                  onClick={() => ui.setAreaSel(a.id)}
                >
                  <span style="flex:1">{a.name}</span>
                  <span class="meta">rec. ATP {a.recommendedAtp}</span>
                </button>
              )}
            </For>
          </div>
          <h3 style="margin-top:10px">Difficulty</h3>
          <div class="chip-row">
            <For each={Object.keys(DIFFICULTIES) as DifficultyId[]}>
              {(d) => (
                <button
                  class="chip hex"
                  classList={{ selected: d === ui.diffSel() }}
                  data-action="diff"
                  data-id={d}
                  onClick={() => ui.setDiffSel(d)}
                >
                  {DIFFICULTIES[d].label}
                </button>
              )}
            </For>
          </div>
          <h3 style="margin-top:10px">Attack pattern</h3>
          <div class="chip-row">
            <For each={Object.keys(PATTERN_PRESETS)}>
              {(name) => (
                <button
                  class="chip"
                  classList={{ selected: name === patternName(ui.selectedEntry().pattern) }}
                  data-action="pattern"
                  data-id={name}
                  onClick={() => ui.act(() => ui.game.setPattern(PATTERN_PRESETS[name]))}
                >
                  {name} <span class="chip-meta">{patternMeta(PATTERN_PRESETS[name])}</span>
                </button>
              )}
            </For>
          </div>
          <button
            class="primary"
            data-action="send"
            style="width:100%;margin-top:14px"
            onClick={() => ui.act(() => ui.game.sendRun(ui.areaSel(), ui.diffSel()))}
          >
            ▶ Accept Quest
          </button>
        </WindowBox>
      </section>
      <aside class="hud-detail">
        <WindowBox title="Counter Settings">
          <h3>Loot filter</h3>
          <div class="row">
            <label>
              Auto-sell below{" "}
              <input
                id="filter-below"
                ref={filterBelow}
                type="number"
                min="0"
                value={ui.selectedEntry().filter.autoSellBelow}
                style="width:90px"
              />{" "}
              m
            </label>
          </div>
          <div class="row">
            <label>
              <input
                id="filter-keep-rare"
                ref={filterKeepRare}
                type="checkbox"
                checked={ui.selectedEntry().filter.alwaysKeep.includes("rare")}
              />{" "}
              keep rares
            </label>
            <button
              class="small"
              data-action="apply-filter"
              onClick={() =>
                ui.act(
                  () =>
                    ui.game.setFilter({
                      autoSellBelow: Number(filterBelow.value),
                      alwaysKeep: filterKeepRare.checked ? ["rare"] : [],
                    }),
                  "filter",
                )
              }
            >
              Apply
            </button>
          </div>
          <h3 style="margin-top:12px">Supply</h3>
          <div class="muted">{supplyLine(ui.state.supply)}</div>
        </WindowBox>
      </aside>
    </>
  );
}

// ---- Shared shop/bank building blocks ---------------------------------------

function ItemRow(props: { item: Item; trailing: string; onSelect: () => void }) {
  const ui = useUi();
  return (
    <button
      class={`pso-menu-row rarity-${props.item.rarity}`}
      classList={{ selected: props.item.id === ui.detailId() }}
      data-action="detail"
      data-id={props.item.id}
      onClick={props.onSelect}
    >
      <KindIcon kind={props.item.kind} />
      <span class="name" style="flex:1">
        {props.item.name}
      </span>
      <span class="meta num">{props.trailing}</span>
    </button>
  );
}

function ItemDetailHead(props: { item: Item }) {
  return (
    <>
      <div class="detail-name">
        <KindIcon kind={props.item.kind} /> {props.item.name}
      </div>
      <div class="detail-flavor">{itemFlavor(props.item)}</div>
      <div class="muted small" style="margin-bottom:8px">
        {itemMeta(props.item)}
      </div>
    </>
  );
}

function EquippedLine(props: { current: Item }) {
  return (
    <div class="equipped-line">
      <span class="equipped-mark">E</span> {props.current.name} —{" "}
      <span class="muted small">{itemMeta(props.current)}</span>
    </div>
  );
}

/** The equipped item currently occupying the slot an item would go into. */
function useEquippedInSlot() {
  const ui = useUi();
  return (item: Item): Item | null => {
    const eq = ui.selectedChar().equipment;
    return item.kind === "weapon" ? eq.weapon : item.kind === "frame" ? eq.frame : item.kind === "barrier" ? eq.barrier : null;
  };
}

// ---- Gear shops (weapon / armour counters) ----------------------------------

export function GearShopPane(props: { kind: "weapon" | "armour" }) {
  const ui = useUi();
  const equippedInSlot = useEquippedInSlot();
  const stock = () => ui.selectedEntry().shop[props.kind];
  const sel = () => stock().offers.find((o) => o.id === ui.detailId()) ?? stock().offers[0] ?? null;
  const emptyMsg = () => `Sold out — stock refreshes as ${ui.selectedChar().name} gains levels.`;
  const atUnitCap = (item: Item) =>
    isUnit(item) && ui.selectedChar().equipment.units.length >= unitCapacity(ui.selectedChar().equipment);

  return (
    <>
      <section class="hud-pane">
        <WindowBox
          title={PANE_LABELS[props.kind === "weapon" ? "weapon-shop" : "armour-shop"]}
          trailing={`${stock().offers.length} in stock`}
        >
          <div class="pso-menu shop-list">
            <Show when={stock().offers.length > 0} fallback={<div class="muted">{emptyMsg()}</div>}>
              <For each={stock().offers}>
                {(o) => <ItemRow item={o} trailing={`${priceForItem(o)}m`} onSelect={() => ui.setDetailId(o.id)} />}
              </For>
            </Show>
          </div>
        </WindowBox>
      </section>
      <aside class="hud-detail">
        <WindowBox title="Item Info">
          <div class="shop-detail">
            <Show when={sel()} fallback={<div class="muted">{emptyMsg()}</div>}>
              {(item) => (
                <>
                  <ItemDetailHead item={item()} />
                  <Show when={equippedInSlot(item())}>{(cur) => <EquippedLine current={cur()} />}</Show>
                  <h3>If equipped</h3>
                  <Show
                    when={!atUnitCap(item())}
                    fallback={<div class="muted">No free unit slot — equip a frame with room first.</div>}
                  >
                    <StatPreview slot={item().kind as "weapon" | "frame" | "barrier" | "unit"} item={item()} />
                  </Show>
                  <div class="row" style="margin-top:12px">
                    <span class="muted">{priceForItem(item())}m</span>
                    <button
                      class="primary"
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
        </WindowBox>
      </aside>
    </>
  );
}

// ---- Tool shop ----------------------------------------------------------------

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
        <WindowBox title="Tool Shop" trailing={`${stock().offers.length} in stock`}>
          <div class="pso-menu shop-list">
            <For each={stock().offers}>
              {(offer) => {
                if (offer.type === "consumable") {
                  const c = CONSUMABLES[offer.id];
                  return (
                    <button
                      class="pso-menu-row"
                      classList={{ selected: c.id === ui.detailId() }}
                      data-action="detail"
                      data-id={c.id}
                      onClick={() => ui.setDetailId(c.id)}
                    >
                      <KindIcon kind={c.kind} />
                      <span style="flex:1">{c.name}</span>
                      <span class="meta num">{c.price}m</span>
                    </button>
                  );
                }
                if (offer.type === "grinder") {
                  return (
                    <button
                      class="pso-menu-row"
                      classList={{ selected: ui.detailId() === "grinder" }}
                      data-action="detail"
                      data-id="grinder"
                      onClick={() => ui.setDetailId("grinder")}
                    >
                      <Icon id="grinder" />
                      <span style="flex:1">Grinder</span>
                      <span class="meta num">{GRINDER_PRICE}m</span>
                    </button>
                  );
                }
                return (
                  <ItemRow
                    item={offer.item}
                    trailing={`${priceForItem(offer.item)}m`}
                    onSelect={() => ui.setDetailId(offer.item.id)}
                  />
                );
              }}
            </For>
          </div>
        </WindowBox>
      </section>
      <aside class="hud-detail">
        <WindowBox title="Item Info">
          <div class="shop-detail">
            <Switch fallback={<div class="muted">Select an item.</div>}>
              <Match when={ui.detailId() === "grinder"}>
                <div class="detail-name">
                  <Icon id="grinder" /> Grinder
                </div>
                <div class="detail-flavor">{flavor("Grinder", "grinder")}</div>
                <div class="muted small" style="margin-bottom:8px">
                  Raises an equipped weapon's grind by 1, up to its cap.
                </div>
                <div class="row" style="margin-top:12px">
                  <span class="muted">{GRINDER_PRICE}m each</span>
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
                    <div class="muted small" style="margin-bottom:8px">
                      {item().tech !== undefined
                        ? "A technique disk. No one aboard can learn techniques yet — one day."
                        : "Kept in inventory; no use for it yet."}
                    </div>
                    <div class="row" style="margin-top:12px">
                      <span class="muted">{priceForItem(item())}m</span>
                      <button
                        class="primary"
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
                    <div class="detail-name">
                      <KindIcon kind={c().kind} /> {c().name}
                    </div>
                    <div class="detail-flavor">{flavor(c().name, c().kind)}</div>
                    <div class="muted small" style="margin-bottom:8px">
                      {c().kind === "heal"
                        ? `Restores ${c().amount} HP during a run.`
                        : c().kind === "revive"
                          ? "Revives once when defeated during a run."
                          : "No use yet — carried for the day its system comes online."}
                    </div>
                    <div class="row" style="margin-top:12px">
                      <span class="muted">{c().price}m each</span>
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
        </WindowBox>
      </aside>
    </>
  );
}

// ---- Inventory/Bank -----------------------------------------------------------

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
                {(i) => <ItemRow item={i} trailing={`${sellPrice(i)}m`} onSelect={() => ui.setDetailId(i.id)} />}
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
                      Sell ({sellPrice(item())}m)
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

// ---- Equipment: PSO-style slot → candidates → preview → equip -------------------

export function EquipmentPane() {
  const ui = useUi();
  const eq = () => ui.selectedChar().equipment;
  const inv = () => ui.state.economy.inventory;
  const cap = () => unitCapacity(eq());

  const slotRows = (): Array<[EquipSlot, string, string]> => [
    ["weapon", "Weapon", eq().weapon ? `${eq().weapon!.name} +${eq().weapon!.grind}` : "— none —"],
    ["frame", "Frame", eq().frame ? eq().frame!.name : "— none —"],
    ["barrier", "Barrier", eq().barrier ? eq().barrier!.name : "— none —"],
    ["units", `Units ${eq().units.length}/${cap()}`, eq().units.map((u) => u.name).join(", ") || "— none —"],
  ];

  const CandRow = (props: {
    id: string;
    name: string;
    meta: JSX.Element;
    rarity?: string;
    kind?: string;
  }) => (
    <button
      class={`pso-menu-row${props.rarity ? ` rarity-${props.rarity}` : ""}`}
      classList={{ selected: props.id === ui.equipCand() }}
      data-action="equip-cand"
      data-id={props.id}
      onClick={() => ui.setEquipCand(props.id)}
    >
      <Show when={props.kind}>{(k) => <KindIcon kind={k()} />}</Show>
      <span class="name" style="flex:1">
        {props.name}
      </span>
      <span class="meta">{props.meta}</span>
    </button>
  );

  const equippedMark = () => <span class="equipped-mark">E</span>;

  return (
    <>
      <section class="hud-pane">
        <WindowBox title="Slots">
          <div class="pso-menu">
            <For each={slotRows()}>
              {([id, label, meta]) => (
                <button
                  class="pso-menu-row"
                  classList={{ selected: id === ui.equipSlot() }}
                  data-action="equip-slot"
                  data-id={id}
                  onClick={() => {
                    ui.setEquipSlot(id);
                    ui.setEquipCand(null);
                  }}
                >
                  <Icon id={SLOT_ICONS[id]} />
                  <span style="flex:1">{label}</span>
                  <span class="meta">{meta}</span>
                </button>
              )}
            </For>
          </div>
        </WindowBox>
        <WindowBox title={`Candidates — ${ui.equipSlot()}`}>
          <div class="pso-menu shop-list">
            <Switch>
              <Match when={ui.equipSlot() === "units"}>
                <For each={eq().units}>
                  {(u) => (
                    <CandRow id={`remove:${u.id}`} name={`Remove ${u.name}`} meta={equippedMark()} rarity={u.rarity} kind={u.kind} />
                  )}
                </For>
                <For each={inv().filter(isUnit)}>
                  {(u) => <CandRow id={u.id} name={u.name} meta={itemMeta(u)} rarity={u.rarity} kind={u.kind} />}
                </For>
                <Show when={eq().units.length === 0 && inv().filter(isUnit).length === 0}>
                  <div class="muted">Nothing equippable — visit the shops or send a run.</div>
                </Show>
              </Match>
              <Match when={ui.equipSlot() !== "units"}>
                {(() => {
                  const slot = () => ui.equipSlot() as "weapon" | "frame" | "barrier";
                  const equipped = () => eq()[slot()];
                  const candidates = () => inv().filter((i) => i.kind === slot());
                  return (
                    <>
                      <Show when={equipped()}>
                        {(cur) => (
                          <CandRow id="remove" name={`Remove ${cur().name}`} meta={equippedMark()} rarity={cur().rarity} kind={cur().kind} />
                        )}
                      </Show>
                      <For each={candidates()}>
                        {(i) => <CandRow id={i.id} name={i.name} meta={itemMeta(i)} rarity={i.rarity} kind={i.kind} />}
                      </For>
                      <Show when={!equipped() && candidates().length === 0}>
                        <div class="muted">Nothing equippable — visit the shops or send a run.</div>
                      </Show>
                    </>
                  );
                })()}
              </Match>
            </Switch>
          </div>
        </WindowBox>
      </section>
      <aside class="hud-detail">
        <WindowBox title="Preview">
          <div class="shop-detail">
            <EquipDetail />
          </div>
        </WindowBox>
      </aside>
    </>
  );
}

/** Right column of the Equipment pane: preview + confirm for the highlighted candidate. */
function EquipDetail() {
  const ui = useUi();
  const eq = () => ui.selectedChar().equipment;
  const cand = () => ui.equipCand();
  const candItem = () => ui.state.economy.inventory.find((i) => i.id === cand());
  const atUnitCap = (item: Item) => isUnit(item) && eq().units.length >= unitCapacity(eq());

  return (
    <Switch>
      {/* No candidate highlighted: the slot's current state (+ grind on weapon). */}
      <Match when={cand() === null}>
        <div class="muted">Select an item to preview the stat change.</div>
        <Show when={ui.equipSlot() === "weapon" && eq().weapon}>
          {(w) => (
            <>
              <div class="muted" style="margin:8px 0 4px">
                {w().name} +{w().grind}/{w().maxGrind}
              </div>
              <div class="row">
                <button class="small" data-action="grind" onClick={() => ui.act(() => ui.game.grindEquippedWeapon(), "grind")}>
                  Grind ({ui.state.economy.grinders} grinders)
                </button>
              </div>
            </>
          )}
        </Show>
      </Match>
      <Match when={cand() === "remove"}>
        {(() => {
          const slot = () => ui.equipSlot() as "weapon" | "frame" | "barrier";
          const equipped = () => eq()[slot()];
          return (
            <Show when={equipped()} fallback={<div class="muted">Nothing equipped.</div>}>
              {(cur) => (
                <>
                  <div class="detail-name">Remove {cur().name}</div>
                  <StatPreview slot={slot()} item={null} />
                  <Show when={slot() === "frame" && eq().units.length > 0}>
                    <div class="muted">Mounted units return to the inventory too.</div>
                  </Show>
                  <div class="row" style="margin-top:12px">
                    <button
                      class="primary"
                      data-action="unequip"
                      data-slot={slot()}
                      onClick={() => {
                        if (ui.act(() => ui.game.unequipToInventory(slot()), "removed")) ui.setEquipCand(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </Show>
          );
        })()}
      </Match>
      <Match when={cand()?.startsWith("remove:")}>
        {(() => {
          const unitId = () => cand()!.slice("remove:".length);
          const unit = () => eq().units.find((x) => x.id === unitId());
          return (
            <Show when={unit()} fallback={<div class="muted">Nothing equipped.</div>}>
              {(u) => (
                <>
                  <div class="detail-name">Remove {u().name}</div>
                  <StatPreview slot="unit" item={null} removeUnitId={unitId()} />
                  <div class="row" style="margin-top:12px">
                    <button
                      class="primary"
                      data-action="unequip-unit"
                      data-id={unitId()}
                      onClick={() => {
                        if (ui.act(() => ui.game.unequipToInventory("unit", unitId()), "removed")) ui.setEquipCand(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </Show>
          );
        })()}
      </Match>
      <Match when={candItem()}>
        {(item) => (
          <>
            <div class="detail-name">
              <KindIcon kind={item().kind} /> {item().name}
            </div>
            <div class="detail-flavor">{itemFlavor(item())}</div>
            <div class="muted small" style="margin-bottom:8px">
              {itemMeta(item())}
            </div>
            <Show
              when={!atUnitCap(item())}
              fallback={
                <div class="muted">
                  {unitCapacity(eq()) === 0
                    ? "No frame equipped — units mount on a frame."
                    : "No free unit slot — remove a unit first."}
                </div>
              }
            >
              <StatPreview slot={item().kind as "weapon" | "frame" | "barrier" | "unit"} item={item()} />
            </Show>
            <div class="row" style="margin-top:12px">
              <button
                class="primary"
                data-action="equip"
                data-id={item().id}
                disabled={atUnitCap(item())}
                onClick={() => {
                  const id = item().id;
                  if (ui.act(() => ui.game.equipFromInventory(id), "equipped")) ui.setEquipCand(null);
                }}
              >
                Equip
              </button>
            </div>
          </>
        )}
      </Match>
      <Match when={true}>
        <div class="muted">Select an item to preview the stat change.</div>
      </Match>
    </Switch>
  );
}
