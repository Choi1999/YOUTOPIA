import { describe, expect, it } from "vitest";
import config from "./vite.config";

describe("G2-M local-only API routes", () => {
  it("proxies both discovery and sampled comments to the same loopback server", () => {
    const expected = {
      target: "http://127.0.0.1:8787",
      changeOrigin: true,
    };
    expect(config).toMatchObject({
      server: {
        proxy: {
          "/api/youtube/discover": expected,
          "/api/youtube/comments": expected,
        },
      },
    });
  });
});
