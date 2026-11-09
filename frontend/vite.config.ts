import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/youtube/discover": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      // G2-M top-level comment samples use the same local-only Node proxy.
      "/api/youtube/comments": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});