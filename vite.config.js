import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },

  base: "./",

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "lyrics-bar": resolve(__dirname, "lyrics-bar.html"),
      },
    },
    outDir: "dist",
  },
});
