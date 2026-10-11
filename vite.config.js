import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Everything is inlined into a single index.html — no separate JS/CSS files,
// no dist/assets/ folder, no accumulating hashed filenames.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    chunkSizeWarningLimit: 2000,
    // Keep the output clean — always overwrite the same index.html
    emptyOutDir: true,
  },
});
