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
  // UI-R04-AO: opt-in, local-loopback-only Spring session proxy. Never enabled
  // in production builds or by default. No broad /api passthrough and no
  // YouTube/provider endpoints can be reached through this route.
  const authProxyEnabled = command === "serve" &&
    loadEnv(mode, process.cwd(), "VITE_R04AO_")
      .VITE_R04AO_LOCAL_AUTH_PROXY === "enabled";
  const authPort = authProxyEnabled
    ? loadEnv(mode, process.cwd(), "YOUTOPIA_LOCAL_").YOUTOPIA_LOCAL_AUTH_PORT
    : undefined;
  if (authProxyEnabled && (!authPort || !/^[0-9]{4,5}$/.test(authPort) ||
      Number(authPort) < 1024 || Number(authPort) > 65535))
    throw new Error("Set an explicit local Spring auth port (YOUTOPIA_LOCAL_AUTH_PORT).");
  const authLoopback = {
    target: "http://127.0.0.1:" + authPort,
    changeOrigin: false, secure: false, ws: false,
  };
  return {
    plugins:[react()],
    server: (enabled || authProxyEnabled) ? {
      proxy: {
        ...(enabled ? {
          // Keep synthetic fixtures isolated and opt-in.
          "^/api/v1/youtube/metadata/synthetic(?:/|$)": loopback,
          ...(statesEnabled ? {
            "^/api/v1/youtube/metadata/synthetic-state(?:/|$)": loopback,
          } : {}),
          ...(agDenied ? {
            "^/api/v1/youtube/metadata/consumer-offline(?:/|$)": loopback,
          } : {}),
        } : {}),
        ...(authProxyEnabled ? {
          "^/api/v1/auth/(?:csrf|login|me|logout)$": authLoopback,
        } : {}),
      },
    } : undefined,
  };
});
