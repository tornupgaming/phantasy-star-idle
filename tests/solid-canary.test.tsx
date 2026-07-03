// @vitest-environment jsdom
// Canary: Solid's client build must mount and react under jsdom. If the
// vitest resolve conditions ever regress to Solid's server build, this fails
// fast with "client-only API" instead of obscure failures in the UI suites.
import { describe, expect, it } from "vitest";
import { render } from "solid-js/web";
import { createSignal } from "solid-js";

describe("solid under jsdom", () => {
  it("mounts a component and updates fine-grained", () => {
    const root = document.createElement("div");
    const [n, setN] = createSignal(1);
    const dispose = render(
      () => <span class="canary">count {n()}</span>,
      root,
    );
    const span = root.querySelector(".canary")!;
    expect(span.textContent).toBe("count 1");
    setN(2);
    expect(span.textContent).toBe("count 2");
    // Fine-grained: the element itself must not have been replaced.
    expect(root.querySelector(".canary")).toBe(span);
    dispose();
    expect(root.innerHTML).toBe("");
  });
});
