import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// Test configuration lives in vitest.config.ts (it needs Solid's browser
// resolve conditions, which must not apply to the production build).
export default defineConfig({
  root: ".",
  // Relative base so the build works when served from a subpath
  // (e.g. GitHub Pages at /phantasy-star-idle/).
  base: "./",
  plugins: [solid()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
