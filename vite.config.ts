import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // Relative base so the build works when served from a subpath
  // (e.g. GitHub Pages at /phantasy-star-idle/).
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
