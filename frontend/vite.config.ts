import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const testPort = process.env.YOUTOPIA_TEST_HTTP_PORT ?? "28080";
if (!/^[0-9]{4,5}$/.test(testPort) || Number(testPort) < 1024 || Number(testPort) > 65535)
  throw new Error("A loopback development API port is required");
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://127.0.0.1:" + testPort, changeOrigin: false } } },
});
