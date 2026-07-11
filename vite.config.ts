import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { execFileSync } from "node:child_process";

const buildCommit = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
  encoding: "utf8",
}).trim();
const buildTime = new Date().toISOString();

// Test configuration lives in vitest.config.ts (it needs Solid's browser
// resolve conditions, which must not apply to the production build).
export default defineConfig({
  root: ".",
  // Relative base so the build works when served from a subpath
  // (e.g. GitHub Pages at /phantasy-star-idle/).
  base: "./",
  plugins: [solid(), tailwindcss()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
