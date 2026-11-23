import { defineConfig } from "vite";
// @ts-expect-error Authored static content plugin, shared with Node checks.
import { publicSite } from "./scripts/site-plugin.mjs";
export default defineConfig({
  plugins: [publicSite()],
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  server: { proxy: { "/api": "http://127.0.0.1:8789" } },
  build: { target: "es2022" },
});
