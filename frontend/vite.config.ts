import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** UI-R04-AA: explicit DEV-only same-origin test fixture proxies. */
export default defineConfig(({command, mode}) => {
  const enabled = command === "serve" &&
    loadEnv(mode, process.cwd(), "VITE_R04Y_").VITE_R04Y_SYNTHETIC_HTTP === "enabled";
  const statesEnabled = enabled &&
    loadEnv(mode, process.cwd(), "VITE_R04AA_").VITE_R04AA_METADATA_STATES === "enabled";
  const agDenied = enabled &&
    loadEnv(mode, process.cwd(), "VITE_R04AC_").VITE_R04AC_DIAGNOSTICS === "enabled" &&
    loadEnv(mode, process.cwd(), "VITE_R04AG_").VITE_R04AG_CONSUMER_DENIAL === "enabled";
  const loopback = {
    target: "http://127.0.0.1:8765",
    changeOrigin: false, secure: false, ws: false,
  };
  return {
    plugins:[react()],
    server: enabled ? {
      proxy: {
        // Use regex route boundaries: the old prefix must NOT implicitly
        // forward synthetic-state routes without the additional state flag.
        "^/api/v1/youtube/metadata/synthetic(?:/|$)": loopback,
        ...(statesEnabled ? {
          "^/api/v1/youtube/metadata/synthetic-state(?:/|$)": loopback,
        } : {}),
        // AG probes the deny route only in DEV; the pinned R04X test server
        // does NOT register AF's separate MockMvc-only consumer controller.
        ...(agDenied ? {
          "^/api/v1/youtube/metadata/consumer-offline(?:/|$)": loopback,
        } : {}),
      },
    } : undefined,
  };
});
