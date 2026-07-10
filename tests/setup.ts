import { vi } from "vitest";

// jsdom deliberately does not implement canvas rendering and emits a noisy
// "Not implemented" error when getContext is called. UI tests exercise DOM
// behavior rather than pixels, so model the supported no-context fallback.
if (typeof HTMLCanvasElement !== "undefined") {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
}
