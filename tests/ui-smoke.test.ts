// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { memoryStorage } from "../src/engine/save";
import { Game } from "../src/engine/game";
import { priceForItem } from "../src/engine/pricing";
import { meetsRequirements } from "../src/engine/character";
import { mountApp } from "../src/ui/app";

const click = (root: HTMLElement, sel: string) => {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`not found: ${sel}`);
  el.click();
};

const disposers: Array<() => void> = [];
const mount = (root: HTMLElement, game: Game) => {
  const app = mountApp(root, game);
  disposers.push(app.dispose);
  return app;
};
afterEach(() => {
  while (disposers.length) disposers.pop()!();
  document.body.innerHTML = "";
});

describe("UI smoke (manual-pass stand-in)", () => {
  it("select → create → hub → shops/bank → accept quest", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    mount(root, game);

    // Boots to character select: slot card for the starter + an empty slot.
    expect(root.textContent).toContain("Select Character");
    expect(root.textContent).toContain("Lv 1 HUmar");
    expect(root.textContent).toContain("Empty Slot");

    // Empty slot → create screen (class list first, BB order).
    click(root, '[data-action="goto"][data-screen="create"]');
    expect(root.textContent).toContain("Create Character");

    // Pick RAmarl, type a name; derived section ID updates live.
    click(root, '[data-action="pick-class"][data-id="ramarl"]');
    const nameInput = root.querySelector<HTMLInputElement>("#new-name")!;
    nameInput.value = "Sue";
    // bubbles: Solid delegates input events at the document level.
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.querySelector("#create-sid")!.textContent).toBeTruthy();

    // Create → auto-select → lands on the hub's Guild pane, status bar on top.
    click(root, '[data-action="create-char"]');
    expect(game.state.roster).toHaveLength(2);
    expect(root.textContent).toContain("Pioneer 2");
    expect(root.textContent).toContain("Sue");
    // Class name is off the hub HUD (player-hud spec); capsule shows Lv + name.
    expect(root.textContent).not.toContain("RAmarl");
    expect(root.textContent).toContain("Total Exp");
    expect(root.textContent).toContain("To Next Lv");
    expect(root.textContent).toContain("Hunter's Guild");

    // Weapon Shop pane: buy an offer into the shared inventory. Authentic
    // prices exceed the starting purse and a fresh RAmarl meets no shop
    // weapon's stat requirement, so bankroll and level her a little first.
    game.state.economy.meseta = 100_000;
    game.selectedCharacter().level = 5;
    click(root, '[data-action="pane"][data-pane="weapon-shop"]');
    const offer = game
      .shopStock("weapon")
      .offers.find(
        (o) =>
          priceForItem(o) <= game.state.economy.meseta &&
          o.kind === "weapon" && meetsRequirements(game.selectedCharacter(), o).ok,
      )!;
    expect(offer.kind).toBe("weapon");
    const mesetaBefore = game.state.economy.meseta;
    click(root, `[data-action="detail"][data-id="${offer.id}"]`);
    expect(root.textContent).toContain("If equipped"); // stat preview in shop detail
    click(root, `[data-action="buy-gear"][data-kind="weapon"][data-id="${offer.id}"]`);
    expect(game.state.economy.meseta).toBeLessThan(mesetaBefore);
    expect(game.state.economy.inventory.some((i) => i.id === offer.id)).toBe(true);
    // Status bar reflects the new balance with the meseta image icon.
    expect(root.querySelector(`.meseta-amount[aria-label="${game.state.economy.meseta} meseta"] .meseta-icon`)).toBeTruthy();

    // Armour shop pane offers only frames/barriers/units.
    click(root, '[data-action="pane"][data-pane="armour-shop"]');
    expect(game.shopStock("armour").offers.every((o) => o.kind !== "weapon")).toBe(true);

    // Tool shop pane renders its list+detail shape.
    click(root, '[data-action="pane"][data-pane="tool-shop"]');
    expect(root.textContent).toContain("Grinder");

    // Equipment pane: PSO flow — weapon slot → candidate → preview → equip.
    click(root, '[data-action="pane"][data-pane="equipment"]');
    expect(root.textContent).toContain("Slots");
    const weapon = game.state.economy.inventory.find((i) => i.kind === "weapon")!;
    click(root, `[data-action="equip-cand"][data-id="${weapon.id}"]`);
    expect(root.querySelector(".diff-table")).toBeTruthy(); // stat preview shown
    expect(game.selectedCharacter().equipment.weapon).toBeNull(); // not committed yet
    click(root, `[data-action="equip"][data-id="${weapon.id}"]`);
    expect(game.selectedCharacter().equipment.weapon?.id).toBe(weapon.id);

    // Inventory/Bank pane renders the shared inventory.
    click(root, '[data-action="pane"][data-pane="bank"]');
    expect(root.textContent).toContain("Inventory");

    // Accept a quest from the Guild pane → run view renders.
    click(root, '[data-action="pane"][data-pane="guild"]');
    // All four difficulties are selectable, Very Hard included.
    const diffButtons = [...root.querySelectorAll('[data-action="diff"]')];
    expect(diffButtons.map((b) => b.getAttribute("data-id"))).toEqual([
      "normal",
      "hard",
      "vhard",
      "ultimate",
    ]);
    click(root, '[data-action="send"]');
    expect(root.textContent).toContain("Run in progress");
  });

  it("weapon-range-avoidance: AVD chip on shop cards, avoidance shown when equipping/barehanded", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    mount(root, game);
    click(root, '[data-action="select-char"]');

    // Weapon shop: every listed weapon card shows an AVD chip (design D4).
    click(root, '[data-action="pane"][data-pane="weapon-shop"]');
    const cards = [...root.querySelectorAll('.shop-list [role="option"]')];
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(card.textContent).toContain("AVD");

    // Equipment pane, weapon slot: unequip the starter weapon and confirm the
    // barehanded (fist) avoidance shows (character-equipment spec: barehanded
    // scenario). Fist and starter saber share the same 20% tier (design D1),
    // so removing it first is the only way to distinguish the two states.
    click(root, '[data-action="pane"][data-pane="equipment"]');
    expect(game.selectedCharacter().equipment.weapon).not.toBeNull();
    click(root, `[data-action="equip-cand"][data-id="remove"]`);
    click(root, '[data-action="unequip"][data-slot="weapon"]');
    expect(game.selectedCharacter().equipment.weapon).toBeNull();
    expect(root.textContent).toMatch(/AVD 20%/); // fist tier (design D1)

    // Previewing a candidate weapon shows its avoidance in the preview table
    // alongside the other stat rows (swap-preview scenario).
    game.state.economy.meseta = 100_000;
    game.selectedCharacter().level = 5;
    click(root, '[data-action="pane"][data-pane="weapon-shop"]');
    const offer = game
      .shopStock("weapon")
      .offers.find(
        (o) =>
          priceForItem(o) <= game.state.economy.meseta &&
          o.kind === "weapon" &&
          meetsRequirements(game.selectedCharacter(), o).ok,
      )!;
    click(root, `[data-action="detail"][data-id="${offer.id}"]`);
    click(root, `[data-action="buy-gear"][data-kind="weapon"][data-id="${offer.id}"]`);

    click(root, '[data-action="pane"][data-pane="equipment"]');
    const weapon = game.state.economy.inventory.find((i) => i.kind === "weapon")!;
    click(root, `[data-action="equip-cand"][data-id="${weapon.id}"]`);
    const previewRows = [...root.querySelectorAll(".diff-table tr")].map((r) => r.textContent);
    expect(previewRows.some((r) => r?.includes("AVD"))).toBe(true);

    // Equip it, then the equipped-weapon display shows its avoidance too.
    click(root, `[data-action="equip"][data-id="${weapon.id}"]`);
    expect(root.textContent).toMatch(/AVD \d+%/);
  });

  it("unlimited roster on the select screen", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    for (let i = game.state.roster.length; i < 6; i++) {
      expect(game.createCharacter(`Alt${i}`, "humar").ok).toBe(true);
    }
    mount(root, game);
    expect(root.querySelectorAll('[data-action="select-char"]').length).toBe(6);
  });

  it("fine-grained updates: interacting with a pane preserves surrounding DOM", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    const app = mount(root, game);

    click(root, '[data-action="select-char"]');
    click(root, '[data-action="pane"][data-pane="tool-shop"]');

    const hud = root.querySelector(".hud")!;
    const nav = root.querySelector(".hud-nav .pso-menu")!;
    const dlgWindow = root.querySelector(".dialogue-window")!;
    const list = root.querySelector(".hud-pane .pso-menu")!;

    // A pane-local interaction (select a tool) must not rebuild the shell.
    click(root, '[data-action="detail"][data-id="grinder"]');
    expect(root.querySelector(".hud")).toBe(hud);
    expect(root.querySelector(".hud-nav .pso-menu")).toBe(nav);
    expect(root.querySelector(".dialogue-window")).toBe(dlgWindow);
    expect(root.querySelector(".hud-pane .pso-menu")).toBe(list);

    // A poll-driven sync with unrelated engine changes keeps the same nodes too.
    game.state.economy.meseta += 1;
    app.sync();
    expect(root.querySelector(".hud")).toBe(hud);
    expect(root.querySelector(".hud-pane .pso-menu")).toBe(list);
    expect(root.querySelector(`.meseta-amount[aria-label="${game.state.economy.meseta} meseta"] .meseta-icon`)).toBeTruthy();
  });

  it("dialogue typewriter survives unrelated re-renders mid-reveal", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    const app = mount(root, game);

    click(root, '[data-action="select-char"]'); // greeting starts revealing
    const dlg = root.querySelector<HTMLElement>(".dlg-text")!;
    await new Promise((r) => setTimeout(r, 60));
    const midway = dlg.textContent!;
    expect(midway.length).toBeGreaterThan(0);

    // Unrelated engine update + sync must not restart or displace the reveal.
    game.state.economy.meseta += 1;
    app.sync();
    expect(root.querySelector(".dlg-text")).toBe(dlg);
    await new Promise((r) => setTimeout(r, 60));
    expect(dlg.textContent!.length).toBeGreaterThanOrEqual(midway.length);

    // A click on the dialogue window completes the line instantly.
    click(root, '[data-action="dlg-skip"]');
    expect(dlg.textContent!.length).toBeGreaterThan(midway.length);
  });
});

describe("keyboard menu navigation (ui-navigation)", () => {
  const key = (k: string) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

  it("digits jump panes, arrows move focus and rows, Enter confirms", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    mount(root, game);
    click(root, '[data-action="select-char"]');

    // Digit shortcut: 4 = Tool Shop.
    key("4");
    expect(root.textContent).toContain("Tool Shop");

    // Nav window (menu 0) has keyboard focus; ArrowRight moves to the pane
    // list (the tool shop's Nova card stack, a listbox of option cards).
    expect(root.querySelector(".hud-nav .pso-menu")!.classList.contains("kbd-active")).toBe(true);
    key("ArrowRight");
    expect(root.querySelector('.hud-pane [role="listbox"]')!.classList.contains("kbd-active")).toBe(true);

    // ArrowDown selects the first row (no prior selection), then advances.
    key("ArrowDown");
    const rows = root.querySelectorAll('.hud-pane [role="option"]');
    expect(rows[0].getAttribute("aria-selected")).toBe("true");
    key("ArrowDown");
    expect(rows[1].getAttribute("aria-selected")).toBe("true");

    // Focus survives an unrelated selection change (no restoration pass).
    expect(root.querySelector('.hud-pane [role="listbox"]')!.classList.contains("kbd-active")).toBe(true);

    // ArrowLeft steps back to the nav window.
    key("ArrowLeft");
    expect(root.querySelector(".hud-nav .pso-menu")!.classList.contains("kbd-active")).toBe(true);

    // Enter on the Guild pane accepts the quest (primary action).
    key("1");
    key("Enter"); // completes the greeting reveal first
    key("Enter"); // confirms ▶ Accept Quest
    expect(game.state.activeRun).not.toBeNull();
    expect(root.textContent).toContain("Run in progress");
  });

  it("destination menu is zone-grouped, skips headings, and gates episodes", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    mount(root, game);
    click(root, '[data-action="select-char"]'); // lands on the guild pane

    // Zone-grouped destination list in the detail panel: 14 areas, 4 headings.
    const menu = root.querySelector(".hud-detail .pso-menu")!;
    const rows = menu.querySelectorAll<HTMLElement>(".pso-menu-row");
    expect(rows).toHaveLength(14);
    expect([...menu.querySelectorAll("h3")].map((h) => h.textContent)).toEqual([
      "Forest",
      "Caves",
      "Mines",
      "Ruins",
    ]);
    expect(rows[0].dataset.id).toBe("forest-1");
    expect(rows[0].classList.contains("selected")).toBe(true);

    // Arrow traversal walks rows only — from Forest 2 it lands on the Dragon
    // boss row, straight past the Caves heading on the next press.
    key("ArrowRight"); // nav window → destination menu
    key("ArrowDown");
    expect(menu.querySelector(".selected")!.getAttribute("data-id")).toBe("forest-2");
    key("ArrowDown");
    expect(menu.querySelector(".selected")!.getAttribute("data-id")).toBe("dragon");
    key("ArrowDown");
    expect(menu.querySelector(".selected")!.getAttribute("data-id")).toBe("cave-1");

    // Boss rows are marked; Ep2/Ep4 chips are visible but disabled.
    expect(menu.querySelector('[data-id="dragon"]')!.textContent).toContain("BOSS");
    expect(root.querySelector<HTMLButtonElement>('[data-action="episode"][data-id="1"]')!.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-action="episode"][data-id="2"]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-action="episode"][data-id="4"]')!.disabled).toBe(true);

    // Dispatching a newly selectable area works end-to-end.
    key("ArrowUp");
    key("ArrowUp"); // cave-1 → dragon → forest-2
    expect(menu.querySelector(".selected")!.getAttribute("data-id")).toBe("forest-2");
    key("Enter"); // Accept Quest with Forest 2 selected
    expect(game.state.activeRun?.input.areaId).toBe("forest-2");
  });
});

/** The 6.2 manual-pass script, automated: v2 save → migration → full hub walk. */
describe("hub walk from a migrated v2 save (pioneer2-hub-redesign 6.2)", () => {
  const v2Save = () => ({
    version: 2,
    savedAt: 1_000_000,
    state: {
      roster: [
        {
          character: {
            id: "char-1",
            name: "Ash",
            classId: "humar",
            sectionId: "Viridia",
            level: 3,
            xp: 200,
            equipment: {
              weapon: {
                id: "w-old", defId: "hand-blade", name: "Hand Blade", kind: "weapon",
                rarity: "common", sellValue: 40, weaponType: "saber", minAtp: 35,
                spread: 18, attribute: 0.05, ata: 30, grind: 0, maxGrind: 5,
              },
              frame: null,
              barrier: null,
              units: [],
            },
          },
          filter: { autoSellBelow: 0, alwaysKeep: [] },
          pattern: ["normal", "heavy"],
          survival: { healAtPct: 0.4, fleeAtPct: 0.1 },
          shop: { band: 0, restock: 0, offers: [] }, // old mixed-stock shape
        },
      ],
      selectedCharacterId: "char-1",
      charCounter: 1,
      economy: { meseta: 5000, grinders: 1, inventory: [] },
      supply: {},
      runCounter: 0,
      activeRun: null,
      lastReport: null,
    },
  });

  it("walks every sidebar entry, buys from both shops, runs and dismisses the report", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const storage = memoryStorage({ "psi.save": JSON.stringify(v2Save()) });
    let now = 1_000_000;
    const game = Game.loadOrNew(storage, () => now);
    const app = mountApp(root, game);

    // Migrated save boots to select with the old character intact.
    click(root, '[data-action="select-char"]');
    expect(root.textContent).toContain("Hunter's Guild"); // lands on Guild pane

    // Buy one offer from each gear counter.
    for (const kind of ["weapon", "armour"] as const) {
      click(root, `[data-action="pane"][data-pane="${kind}-shop"]`);
      const offer = game
        .shopStock(kind)
        .offers.find((o) => priceForItem(o) <= game.state.economy.meseta)!;
      click(root, `[data-action="detail"][data-id="${offer.id}"]`);
      click(root, `[data-action="buy-gear"][data-kind="${kind}"][data-id="${offer.id}"]`);
      expect(game.state.economy.inventory.some((i) => i.id === offer.id)).toBe(true);
    }

    // Remaining panes render inside the shell (status bar stays up).
    for (const pane of ["tool-shop", "equipment", "bank", "guild"] as const) {
      click(root, `[data-action="pane"][data-pane="${pane}"]`);
      expect(root.textContent).toContain("Total Exp");
    }

    // Accept a quest, fast-forward past the end, settle: the report dialog
    // appears over the Guild pane and dismisses in place.
    click(root, '[data-action="send"]');
    expect(root.textContent).toContain("Run in progress");
    now += game.runProgress()!.endTime + 60_000;
    expect(game.poll()).toBe(true);
    app.sync();
    expect(root.querySelector(".dialog-scrim")).not.toBeNull();
    expect(root.textContent).toContain("Hunter's Guild");
    click(root, '[data-action="dismiss-report"]');
    expect(root.querySelector(".dialog-scrim")).toBeNull();
    expect(root.textContent).toContain("Hunter's Guild");

    // Change Character exits to the select screen.
    click(root, '[data-action="goto"][data-screen="select"]');
    expect(root.textContent).toContain("Select Character");
    app.dispose();
  });
});
