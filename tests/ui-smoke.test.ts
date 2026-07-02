// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { memoryStorage } from "../src/engine/save";
import { Game } from "../src/engine/game";
import { gearPrice } from "../src/engine/shop";
import { UI } from "../src/ui/views";

const click = (root: HTMLElement, sel: string) => {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`not found: ${sel}`);
  el.click();
};

describe("UI smoke (manual-pass stand-in)", () => {
  it("select → create → hub → shops/bank → accept quest", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    const ui = new UI(root, game);
    ui.render();

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
    nameInput.dispatchEvent(new Event("input"));
    expect(root.querySelector("#create-sid")!.textContent).toBeTruthy();

    // Create → auto-select → lands on the hub's Guild pane, status bar on top.
    click(root, '[data-action="create-char"]');
    expect(game.state.roster).toHaveLength(2);
    expect(root.textContent).toContain("Pioneer 2");
    expect(root.textContent).toContain("Sue");
    expect(root.textContent).toContain("RAmarl");
    expect(root.textContent).toContain("Total Exp");
    expect(root.textContent).toContain("To Next Lv");
    expect(root.textContent).toContain("Hunter's Guild");

    // Weapon Shop pane: buy an affordable offer into the shared inventory.
    click(root, '[data-action="pane"][data-pane="weapon-shop"]');
    const offer = game
      .shopStock("weapon")
      .offers.find((o) => gearPrice(o) <= game.state.economy.meseta)!;
    expect(offer.kind).toBe("weapon");
    const mesetaBefore = game.state.economy.meseta;
    click(root, `[data-action="detail"][data-id="${offer.id}"]`);
    expect(root.textContent).toContain("If equipped"); // stat preview in shop detail
    click(root, `[data-action="buy-gear"][data-kind="weapon"][data-id="${offer.id}"]`);
    expect(game.state.economy.meseta).toBeLessThan(mesetaBefore);
    expect(game.state.economy.inventory.some((i) => i.id === offer.id)).toBe(true);
    // Status bar reflects the new balance.
    expect(root.textContent).toContain(`${game.state.economy.meseta} Meseta`);

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
    click(root, '[data-action="send"]');
    expect(root.textContent).toContain("Run in progress");
  });

  it("unlimited roster on the select screen", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    for (let i = game.state.roster.length; i < 6; i++) {
      expect(game.createCharacter(`Alt${i}`, "humar").ok).toBe(true);
    }
    const ui = new UI(root, game);
    ui.render();
    expect(root.querySelectorAll('[data-action="select-char"]').length).toBe(6);
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
    const ui = new UI(root, game);
    ui.render();

    // Migrated save boots to select with the old character intact.
    click(root, '[data-action="select-char"]');
    expect(root.textContent).toContain("Hunter's Guild"); // lands on Guild pane

    // Buy one offer from each gear counter.
    for (const kind of ["weapon", "armour"] as const) {
      click(root, `[data-action="pane"][data-pane="${kind}-shop"]`);
      const offer = game
        .shopStock(kind)
        .offers.find((o) => gearPrice(o) <= game.state.economy.meseta)!;
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
    ui.render();
    expect(root.querySelector(".dialog-scrim")).not.toBeNull();
    expect(root.textContent).toContain("Hunter's Guild");
    click(root, '[data-action="dismiss-report"]');
    expect(root.querySelector(".dialog-scrim")).toBeNull();
    expect(root.textContent).toContain("Hunter's Guild");

    // Change Character exits to the select screen.
    click(root, '[data-action="goto"][data-screen="select"]');
    expect(root.textContent).toContain("Select Character");
  });
});
