/** Equipment: PSO-style slot → candidates → preview → equip flow. */

import { For, Match, Show, Switch, type JSX } from "solid-js";
import { unitCapacity } from "../../../engine/character";
import { isUnit, type Item } from "../../../engine/items";
import { useUi } from "../../context";
import { SLOT_ICONS, itemDisplayName, itemMeta, weaponAvd, type EquipSlot } from "../../ui-shared";
import { itemFlavor } from "../../dialogue";
import { Icon, KindIcon } from "../atoms/icon";
import { ItemName } from "../atoms/item-name";
import { WindowBox } from "../molecules/window-box";
import { StatPreview } from "./stat-preview";

export function EquipmentPane() {
  const ui = useUi();
  const eq = () => ui.selectedChar().equipment;
  const inv = () => ui.state.economy.inventory;
  const cap = () => unitCapacity(eq());

  const slotRows = (): Array<[EquipSlot, string, JSX.Element]> => [
    ["weapon", "Weapon", eq().weapon ? <ItemName item={eq().weapon!} /> : "— none —"],
    ["frame", "Frame", eq().frame ? <ItemName item={eq().frame!} /> : "— none —"],
    ["barrier", "Barrier", eq().barrier ? <ItemName item={eq().barrier!} /> : "— none —"],
    [
      "units",
      `Units ${eq().units.length}/${cap()}`,
      eq().units.length ? <>{eq().units.map((u) => itemDisplayName(u)).join(", ")}</> : "— none —",
    ],
  ];

  const CandRow = (props: {
    id: string;
    name: JSX.Element;
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
                    <CandRow id={`remove:${u.id}`} name={<>Remove <ItemName item={u} /></>} meta={equippedMark()} rarity={u.rarity} kind={u.kind} />
                  )}
                </For>
                <For each={inv().filter(isUnit)}>
                  {(u) => <CandRow id={u.id} name={<ItemName item={u} />} meta={itemMeta(u)} rarity={u.rarity} kind={u.kind} />}
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
                          <CandRow id="remove" name={<>Remove <ItemName item={cur()} /></>} meta={equippedMark()} rarity={cur().rarity} kind={cur().kind} />
                        )}
                      </Show>
                      <For each={candidates()}>
                        {(i) => <CandRow id={i.id} name={<ItemName item={i} />} meta={itemMeta(i)} rarity={i.rarity} kind={i.kind} />}
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
        <Show when={ui.equipSlot() === "weapon"}>
          <div class="muted small" style="margin:8px 0 4px">
            AVD {weaponAvd(eq().weapon)}%
          </div>
        </Show>
        <Show when={ui.equipSlot() === "weapon" && eq().weapon}>
          {(w) => (
            <>
              <div class="muted" style="margin:8px 0 4px">
                <ItemName item={w()} /> {w().grind > 0 ? `/${w().maxGrind}` : `+0/${w().maxGrind}`}
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
                  <div class="detail-name">Remove <ItemName item={cur()} /></div>
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
                  <div class="detail-name">Remove <ItemName item={u()} /></div>
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
              <KindIcon kind={item().kind} /> <ItemName item={item()} />
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
