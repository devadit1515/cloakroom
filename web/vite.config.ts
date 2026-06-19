import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The real Cloakroom FastAPI service runs on :8000. We proxy the three endpoints
// so the live playground hits the real backend in dev; if it's down, the client
// silently falls back to the mocked pipeline (see src/lib/api.ts).
const target = process.env.CLOAKROOM_API || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/process": { target, changeOrigin: true },
      "/session": { target, changeOrigin: true },
      "/healthz": { target, changeOrigin: true },
    },
  },
  build: { target: "es2020", chunkSizeWarningLimit: 1200 },
});
