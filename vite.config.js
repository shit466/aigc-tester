import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
    assetsInlineLimit: 4096
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: false
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: false
  }
});
