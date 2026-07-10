// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Game } from "../src/engine/game";
import { memoryStorage } from "../src/engine/save";
import { mountApp } from "../src/ui/app";

const mounted: Array<() => void> = [];

afterEach(() => {
  while (mounted.length) mounted.pop()!();
  document.body.innerHTML = "";
});

const mount = (game: Game) => {
  const root = document.body.appendChild(document.createElement("div"));
  mounted.push(mountApp(root, game).dispose);
  return root;
};

describe("UI regimes", () => {
  it("mounts select, create, hub, and active-run regimes across async boundaries", async () => {
    const game = Game.loadOrNew(memoryStorage(), () => 1_000_000);
    const root = mount(game);

    expect(root.textContent).toContain("Select Character");

    root.querySelector<HTMLElement>('[data-action="goto"][data-screen="create"]')!.click();
    expect(root.textContent).toContain("Create Character");

    root.querySelector<HTMLElement>('[data-action="goto"][data-screen="select"]')!.click();
    root.querySelector<HTMLElement>('[data-action="select-char"]')!.click();
    expect(root.textContent).toContain("Hunter's Guild");

    root.querySelector<HTMLElement>('[data-action="send"]')!.click();
    await vi.waitFor(() => expect(root.querySelector(".stage-field")).not.toBeNull());
    expect(root.textContent).toContain("Run in progress");
  });
});
