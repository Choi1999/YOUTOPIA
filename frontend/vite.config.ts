import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * UI-R04-Y: test-only, manual development opt-in. No production proxy.
 * Only the exact synthetic route prefix forwards to the dedicated Spring
 * test-classpath fixture bound on loopback 127.0.0.1:8765.
 */
export default defineConfig(({command, mode}) => {
  const enabled = command === "serve" &&
    loadEnv(mode, process.cwd(), "VITE_R04Y_").VITE_R04Y_SYNTHETIC_HTTP === "enabled";
  return {
    plugins: [react()],
    server: enabled ? {
      proxy: {
        "/api/v1/youtube/metadata/synthetic": {
          target: "http://127.0.0.1:8765",
          changeOrigin: false,
          secure: false,
          ws: false,
        },
      },
    } : undefined,
  };
});
