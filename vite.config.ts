import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome122",
    chunkSizeWarningLimit: 1500
  },
  server: { port: 5173, strictPort: true }
});
