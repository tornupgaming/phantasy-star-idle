import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

// Solid ships separate server/browser builds; under vitest's node runtime the
// server build would be picked and client APIs (render) would throw in jsdom.
// The dev+browser conditions force the client build for the UI tests
// (per vite-plugin-solid's vitest guidance). Engine tests run in plain node
// and import no packages, so the conditions are inert for them.
export default defineConfig({
  plugins: [solid({ hot: false })],
  resolve: { conditions: ["development", "browser"] },
  test: {
    globals: true,
    environment: "node", // UI tests opt into jsdom via @vitest-environment
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    server: { deps: { inline: [/solid-js/] } },
  },
});
