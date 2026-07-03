// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { memoryStorage } from "../src/engine/save";
import { Game } from "../src/engine/game";
import { mountApp } from "../src/ui/app";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("battle stage (run screen)", () => {
  it("mounts once, catches up to game time, and tears down on settle", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    let now = 1_000_000;
    const game = Game.loadOrNew(memoryStorage(), () => now);
    const app = mountApp(root, game);

    // Boot lands on character select; enter the hub, then accept a quest
    // (starter gear is auto-equipped) for the default area.
    root.querySelector<HTMLElement>('[data-action="select-char"]')!.click();
    root.querySelector<HTMLElement>('[data-action="send"]')!.click();
    expect(game.state.activeRun).not.toBeNull();
    expect(root.textContent).toContain("Run in progress");
    expect(root.querySelector(".stage-field")).not.toBeNull();
    const shell = root.querySelector(".stage-field")!;

    // Jump 5s into the run and let a few animation frames fire: the stage
    // catch-up fold must show the current room's enemies and log lines,
    // without the shell being rebuilt (same DOM node).
    now += 5000;
    await sleep(100);
    expect(root.querySelector(".stage-field")).toBe(shell); // persistent DOM
    const enemies = root.querySelectorAll(".stage-enemy");
    expect(enemies.length).toBeGreaterThan(0);
    for (const el of enemies) {
      expect(el.getAttribute("data-enemy-id")).toBeTruthy();
      expect(el.querySelector(".hpbar > span")).not.toBeNull();
    }
    expect(root.querySelectorAll(".stage-log > div").length).toBeGreaterThan(0);
    // The capsule renders the HP label separately; the hook holds `cur/max`.
    expect(root.querySelector(".stage-char-hp-text")!.textContent).toMatch(/^\d+\/\d+$/);

    // A reload mid-run rebuilds the identical scene from the event prefix
    // (the island mounts straight into the run regime).
    const root2 = document.createElement("div");
    document.body.appendChild(root2);
    const app2 = mountApp(root2, game);
    await sleep(100);
    expect(root2.querySelector(".stage-char-hp-text")!.textContent).toBe(
      root.querySelector(".stage-char-hp-text")!.textContent,
    );
    expect(root2.querySelectorAll(".stage-enemy").length).toBe(
      root.querySelectorAll(".stage-enemy").length,
    );

    // Fast-forward past the end; the 1 Hz poll settles and the sync flips the
    // regime switch — the island is disposed and the hub shows the report.
    const endTime = game.runProgress()!.endTime;
    now = game.state.activeRun!.startedAtWall + endTime + 1000;
    expect(game.poll()).toBe(true);
    app.sync();
    app2.sync();
    expect(game.state.activeRun).toBeNull();
    expect(root.textContent).not.toContain("Run in progress");
    expect(root.textContent).toMatch(/Run complete!|Ejected!/);
    // Settle lands on the hub's Guild pane (ui-navigation).
    expect(root.textContent).toContain("Hunter's Guild");
    app.dispose();
    app2.dispose();
  });
});
