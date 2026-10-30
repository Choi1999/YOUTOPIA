import { defineConfig } from "vitest/config";

import react from "@vitejs/plugin-react";

export default defineConfig({
  define: { "import.meta.env.VITE_DEMO_ONLY": '"true"' },
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: "./src/test/setup.ts",
  },
});
