import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRA defaulted to the dev server on port 3000; keep that for parity with
  // any local tooling that points at http://localhost:3000.
  //
  // host: true binds dual-stack (:: with IPv4-mapped), so the dev server
  // answers on BOTH http://localhost:3000 and http://127.0.0.1:3000. With
  // the default host:"localhost", Node binds only the first resolved
  // address (often ::1-only on Windows), which makes 127.0.0.1:3000
  // unreachable and prevents the browser from aligning its origin with the
  // API (http://127.0.0.1:8000) — the FastAPI SameSite=Lax session cookie
  // is then dropped on every cross-site XHR and all API calls 401.
  server: {
    host: true,
    port: 3000,
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
