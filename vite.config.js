import { defineConfig } from "vite";

// Plain Vite build (code split into small files that load in parallel and are cached).
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
