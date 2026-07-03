/**
 * UI-wide state and actions (convert-menu-ui-to-solidjs D4). Everything the
 * old UI class kept as "survives re-renders" fields is a signal here; the
 * engine is reached only through `act()`, which runs the mutation and
 * re-syncs the store (D2). Router semantics are unchanged from the
 * ui-navigation spec: UI-local, never persisted, boots to character select,
 * hub entry lands on the Guild pane.
 */

import { batch, createContext, createSignal, useContext, type Accessor } from "solid-js";
import type { Game, ActionResult, RosterEntry } from "../engine/game";
import type { Character } from "../engine/character";
import type { SectionId } from "../engine/classes";
import { DIFFICULTIES, type DifficultyId } from "../engine/areas";
import { AREA_LIST } from "../engine/content";
import { failureLine, greeting, reaction, type DialoguePane, type ReactionId } from "./dialogue";
import { createTypewriter, type Typewriter } from "./typewriter";
import { CLASSES_CANONICAL, type EquipSlot, type Pane, type Screen } from "./ui-shared";
import type { GameStore } from "./store";

export interface Ui {
  game: Game;
  state: GameStore["state"];
  sync(): void;

  // Router (ui-navigation: UI-local, never persisted).
  screen: Accessor<Screen>;
  goto(screen: Screen): void;
  pane: Accessor<Pane>;
  setPane(pane: Pane): void;

  // Transient UI state (reactive-ui-architecture: survives updates by construction).
  notice: Accessor<string>;
  detailId: Accessor<string | null>;
  setDetailId(id: string | null): void;
  equipSlot: Accessor<EquipSlot>;
  setEquipSlot(slot: EquipSlot): void;
  equipCand: Accessor<string | null>;
  setEquipCand(id: string | null): void;
  reportDismissed: Accessor<boolean>;
  setReportDismissed(v: boolean): void;
  areaSel: Accessor<string>;
  setAreaSel(id: string): void;
  diffSel: Accessor<DifficultyId>;
  setDiffSel(id: DifficultyId): void;
  kbdMenu: Accessor<number>;
  setKbdMenu(i: number): void;

  // Character-create draft (survives leaving and re-entering the screen).
  draft: {
    classId: Accessor<string>;
    setClassId(id: string): void;
    name: Accessor<string>;
    setName(n: string): void;
    sid: Accessor<SectionId | "">;
    setSid(s: SectionId | ""): void;
  };

  // Shopkeeper dialogue.
  dlg: Typewriter;
  sayGreeting(pane: DialoguePane): void;
  react(id: ReactionId): void;

  /**
   * Run an engine mutation, sync the store, and voice the outcome: failures
   * flash (shopkeeper line on the hub, plain notice elsewhere), successes
   * optionally play a reaction line. Returns whether the action succeeded.
   */
  act(action: () => ActionResult | void, okReaction?: ReactionId): boolean;

  // Store-backed selected-character views.
  selectedEntry(): RosterEntry;
  selectedChar(): Character;

  /** Reset hub/menu state on a run settling (called from the App effect). */
  onRunSettled(): void;
}

const UiContext = createContext<Ui>();

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error("useUi outside <UiProvider>");
  return ui;
}

export const UiProvider = UiContext.Provider;

export function createUi(game: Game, gs: GameStore): Ui {
  const [screen, setScreen] = createSignal<Screen>("select");
  const [pane, setPaneRaw] = createSignal<Pane>("guild");
  const [notice, setNotice] = createSignal("");
  const [detailId, setDetailId] = createSignal<string | null>(null);
  const [equipSlot, setEquipSlot] = createSignal<EquipSlot>("weapon");
  const [equipCand, setEquipCand] = createSignal<string | null>(null);
  const [reportDismissed, setReportDismissed] = createSignal(false);
  const [areaSel, setAreaSel] = createSignal(AREA_LIST[0].id);
  const [diffSel, setDiffSel] = createSignal(Object.keys(DIFFICULTIES)[0] as DifficultyId);
  const [kbdMenu, setKbdMenu] = createSignal(0);
  const [draftClass, setDraftClass] = createSignal(CLASSES_CANONICAL[0].id);
  const [draftName, setDraftName] = createSignal("");
  const [draftSid, setDraftSid] = createSignal<SectionId | "">("");

  const dlg = createTypewriter();
  // Line-cycling counters (shop-dialogue): deterministic, non-reactive.
  const greetCycles: Partial<Record<DialoguePane, number>> = {};
  let reactCycle = 0;

  const sayGreeting = (p: DialoguePane) => {
    const n = greetCycles[p] ?? 0;
    greetCycles[p] = n + 1;
    dlg.say(greeting(p, n));
  };

  const react = (id: ReactionId) => dlg.say(reaction(id, reactCycle++));

  /** Failure feedback: shopkeeper voice on the hub, plain notice elsewhere. */
  const flash = (msg: string) => {
    if (screen() === "hub") dlg.say(failureLine(msg));
    else setNotice(msg);
  };

  const act = (action: () => ActionResult | void, okReaction?: ReactionId): boolean => {
    setNotice("");
    const res = gs.run(action) ?? { ok: true };
    if (!res.ok) {
      flash(res.reason ?? "Action failed.");
      return false;
    }
    if (okReaction) react(okReaction);
    return true;
  };

  const goto = (s: Screen) =>
    batch(() => {
      setScreen(s);
      if (s === "hub") {
        setPaneRaw("guild");
        sayGreeting("guild");
      }
      setDetailId(null);
      setEquipCand(null);
      setEquipSlot("weapon");
      setNotice("");
      setKbdMenu(0);
    });

  const setPane = (p: Pane) =>
    batch(() => {
      // Entering a gear counter triggers the engine's lazy restock (band may
      // have changed since the last visit) before the pane reads the store.
      if (p === "weapon-shop") gs.run(() => game.shopStock("weapon"));
      if (p === "armour-shop") gs.run(() => game.shopStock("armour"));
      setPaneRaw(p);
      setDetailId(null);
      setEquipCand(null);
      setNotice("");
      setKbdMenu(0);
      sayGreeting(p);
    });

  const selectedEntry = (): RosterEntry => {
    const entry = gs.state.roster.find((e) => e.character.id === gs.state.selectedCharacterId);
    if (!entry) throw new Error("no selected character"); // invariant: roster never empty
    return entry;
  };

  const onRunSettled = () =>
    batch(() => {
      setScreen("hub");
      setPaneRaw("guild");
      setReportDismissed(false);
      setDetailId(null);
      setEquipCand(null);
      setNotice("");
      setKbdMenu(0);
      sayGreeting("guild");
    });

  return {
    game,
    state: gs.state,
    sync: gs.sync,
    screen,
    goto,
    pane,
    setPane,
    notice,
    detailId,
    setDetailId,
    equipSlot,
    setEquipSlot,
    equipCand,
    setEquipCand,
    reportDismissed,
    setReportDismissed,
    areaSel,
    setAreaSel,
    diffSel,
    setDiffSel,
    kbdMenu,
    setKbdMenu,
    draft: {
      classId: draftClass,
      setClassId: setDraftClass,
      name: draftName,
      setName: setDraftName,
      sid: draftSid,
      setSid: setDraftSid,
    },
    dlg,
    sayGreeting,
    react,
    act,
    selectedEntry,
    selectedChar: () => selectedEntry().character,
    onRunSettled,
  };
}
