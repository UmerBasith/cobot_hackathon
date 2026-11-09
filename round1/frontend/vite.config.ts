import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Frontend runs on http://localhost:5173. Anything under /api goes to the
// FastAPI backend on port 8000, so the frontend never needs CORS setup.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    host: true,
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 2000 },
  preview: { port: 4173, host: true, proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } } },
});
