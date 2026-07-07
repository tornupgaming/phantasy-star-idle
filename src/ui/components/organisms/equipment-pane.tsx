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
import chrome from "../chrome.module.css";

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
      class={`pso-menu-row ${chrome.menuRow}${props.rarity ? ` rarity-${props.rarity}` : ""}`}
      classList={{ selected: props.id === ui.equipCand() }}
      data-action="equip-cand"
      data-id={props.id}
      onClick={() => ui.setEquipCand(props.id)}
    >
      <Show when={props.kind}>{(k) => <KindIcon kind={k()} />}</Show>
      <span class="name flex-1">
        {props.name}
      </span>
      <span class="meta">{props.meta}</span>
    </button>
  );

  const equippedMark = () => (
    <span class="inline-block bg-pso-hp text-[#04220a] text-[10px] font-bold leading-[1.4] px-1 rounded-[2px]">E</span>
  );

  return (
    <>
      <section class="hud-pane">
        <WindowBox title="Slots">
          <div class={`pso-menu ${chrome.menu}`}>
            <For each={slotRows()}>
              {([id, label, meta]) => (
                <button
                  class={`pso-menu-row ${chrome.menuRow}`}
                  classList={{ selected: id === ui.equipSlot() }}
                  data-action="equip-slot"
                  data-id={id}
                  onClick={() => {
                    ui.setEquipSlot(id);
                    ui.setEquipCand(null);
                  }}
                >
                  <Icon id={SLOT_ICONS[id]} />
                  <span class="flex-1">{label}</span>
                  <span class="meta">{meta}</span>
                </button>
              )}
            </For>
          </div>
        </WindowBox>
        <WindowBox title={`Candidates — ${ui.equipSlot()}`}>
          <div class={`pso-menu ${chrome.menu} max-h-[62vh] overflow-auto max-[1100px]:max-h-[38vh] max-[900px]:max-h-[50vh]`}>
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
                  <div class="text-muted">Nothing equippable — visit the shops or send a run.</div>
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
                        <div class="text-muted">Nothing equippable — visit the shops or send a run.</div>
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
          <div>
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
        <div class="text-muted">Select an item to preview the stat change.</div>
        <Show when={ui.equipSlot() === "weapon"}>
          <div class="text-muted text-[11.5px] mt-2 mb-1">
            AVD {weaponAvd(eq().weapon)}%
          </div>
        </Show>
        <Show when={ui.equipSlot() === "weapon" && eq().weapon}>
          {(w) => (
            <>
              <div class="text-muted mt-2 mb-1">
                <ItemName item={w()} /> {w().grind > 0 ? `/${w().maxGrind}` : `+0/${w().maxGrind}`}
              </div>
              <div class="flex gap-2 items-center my-1.5 flex-wrap">
                <button
                  class="px-2 py-[3px] text-xs"
                  data-action="grind"
                  onClick={() => ui.act(() => ui.game.grindEquippedWeapon(), "grind")}
                >
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
            <Show when={equipped()} fallback={<div class="text-muted">Nothing equipped.</div>}>
              {(cur) => (
                <>
                  <div class="text-base font-bold text-accent mb-0.5">Remove <ItemName item={cur()} /></div>
                  <StatPreview slot={slot()} item={null} />
                  <Show when={slot() === "frame" && eq().units.length > 0}>
                    <div class="text-muted">Mounted units return to the inventory too.</div>
                  </Show>
                  <div class="flex gap-2 items-center mt-3 mb-1.5 flex-wrap">
                    <button
                      class={`primary ${chrome.btnPrimary}`}
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
            <Show when={unit()} fallback={<div class="text-muted">Nothing equipped.</div>}>
              {(u) => (
                <>
                  <div class="text-base font-bold text-accent mb-0.5">Remove <ItemName item={u()} /></div>
                  <StatPreview slot="unit" item={null} removeUnitId={unitId()} />
                  <div class="flex gap-2 items-center mt-3 mb-1.5 flex-wrap">
                    <button
                      class={`primary ${chrome.btnPrimary}`}
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
            <div class="text-base font-bold text-accent mb-0.5">
              <KindIcon kind={item().kind} /> <ItemName item={item()} />
            </div>
            <div class="italic text-[#bcd8e0] text-[12.5px] mt-0.5 mb-1.5">{itemFlavor(item())}</div>
            <div class="text-muted text-[11.5px] mb-2">
              {itemMeta(item())}
            </div>
            <Show
              when={!atUnitCap(item())}
              fallback={
                <div class="text-muted">
                  {unitCapacity(eq()) === 0
                    ? "No frame equipped — units mount on a frame."
                    : "No free unit slot — remove a unit first."}
                </div>
              }
            >
              <StatPreview slot={item().kind as "weapon" | "frame" | "barrier" | "unit"} item={item()} />
            </Show>
            <div class="flex gap-2 items-center mt-3 mb-1.5 flex-wrap">
              <button
                class={`primary ${chrome.btnPrimary}`}
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
        <div class="text-muted">Select an item to preview the stat change.</div>
      </Match>
    </Switch>
  );
}
