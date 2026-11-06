// vite.emulator.config.js — TEST-ONLY vite config: identical to the game but
// aliases src/firebase.js → src/firebase.emu.js (local emulator wiring).
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ROOT,
  resolve: {
    alias: [
      // dev-server aliasing matches the raw IMPORT SPECIFIER — internal modules
      // import "./firebase.js" (relative), so the exact string is what matches.
      { find: "./firebase.js", replacement: path.join(ROOT, "src/firebase.emu.js") },
      { find: /^\/src\/firebase\.js$/, replacement: path.join(ROOT, "src/firebase.emu.js") },
    ],
  },
  server: { port: 5198, strictPort: true },
  build: { outDir: "dist_emu" },
});
