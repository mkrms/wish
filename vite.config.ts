import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @tauri-apps expects a fixed dev port and no auto-clearing of the screen.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  // Tauri uses Chromium on Windows/Linux and WebKit on macOS.
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});
