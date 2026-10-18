import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const here = import.meta.dirname;

export default defineConfig({
  // Relative URLs, so the built site works under any path (GitHub Pages serves it
  // under /leibniz-stepped-reckoner/). Pages load the models as "../../<name>.glb".
  base: "./",
  // Generated models (../assets) are served from the site root.
  publicDir: resolve(here, "../assets"),
  server: {
    // params/machine.json lives outside web/.
    fs: { allow: [resolve(here, "..")] },
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(here, "index.html"),
        "01-digit-slice": resolve(here, "experiments/01-digit-slice/index.html"),
        "02-carry-slice": resolve(here, "experiments/02-carry-slice/index.html"),
        "03-full-machine": resolve(here, "experiments/03-full-machine/index.html"),
        "04-teaching": resolve(here, "experiments/04-teaching/index.html"),
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
