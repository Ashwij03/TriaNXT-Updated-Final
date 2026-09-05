import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRA defaulted to the dev server on port 3000; keep that for parity with
  // any local tooling that points at http://localhost:3000.
  server: {
  port: 3000,
  proxy: {
    "/api": {
      target: "http://127.0.0.1:8000",
      changeOrigin: true,
      secure: false,
    },
  },
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
