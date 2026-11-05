import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyntheticHttpMetadata, syntheticHttpDevEnabled,
  SYNTHETIC_HTTP_PATH, SYNTHETIC_HTTP_MAX_BYTES } from "./workspaceSyntheticHttpClient";
import { simulateOfflineMetadataBackend } from "./workspaceSyntheticMetadata";

const VIDEO = { kind: "VIDEO" as const, id: "Ab0_-123xyz" };
const CHANNEL = { kind: "CHANNEL" as const, id: "UC" + "A".repeat(22) };
const HANDLE = { kind: "CHANNEL_HANDLE" as const, id: "@samplecreator" };

function valid(target: typeof VIDEO | typeof CHANNEL | typeof HANDLE) {
  return new Response(JSON.stringify(simulateOfflineMetadataBackend(target)), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "X-YOUTOPIA-Synthetic": "test-only",
      "Cache-Control": "no-store",
    },
  });
}
beforeEach(() => {
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP", "enabled");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("UI-R04-Y — guarded same-origin HTTP reader", () => {
  it("is disabled unless both dev mode and explicit env are enabled", async () => {
    const fetcher = vi.fn(async () => valid(VIDEO));
    const controller = new AbortController();
    vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP", "");
    expect(syntheticHttpDevEnabled()).toBe(false);
    expect(await fetchSyntheticHttpMetadata(VIDEO, controller.signal,
      fetcher as unknown as typeof fetch)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP", "enabled");
    vi.stubEnv("DEV", false);
    expect(syntheticHttpDevEnabled()).toBe(false);
    expect(await fetchSyntheticHttpMetadata(VIDEO, controller.signal,
      fetcher as unknown as typeof fetch)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses only relative same-origin /api synthetic GET without cookies, redirects or keys", async () => {
    const fetcher = vi.fn(async () => valid(VIDEO));
    const record = await fetchSyntheticHttpMetadata(VIDEO,
      new AbortController().signal, fetcher as unknown as typeof fetch);
    expect(record?.title).toBe("합성 영상 제목 · Ab0_-123xyz");
    expect(record?.sourceAuthenticated).toBe(false);
    expect(record?.providerRequestsMade).toBe(0);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe(
      SYNTHETIC_HTTP_PATH + "/videos/Ab0_-123xyz");
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(options).toMatchObject({
      method: "GET", mode: "same-origin", credentials: "omit",
      redirect: "error", cache: "no-store",
      headers: { Accept: "application/json" },
    });
    expect(JSON.stringify(options)).not.toContain("apiKey");
  });

  it("accepts exact channel or encoded handle response, never guessed membership", async () => {
    for (const target of [CHANNEL, HANDLE]) {
      const fetcher = vi.fn(async () => valid(target));
      const item = await fetchSyntheticHttpMetadata(target,
        new AbortController().signal, fetcher as unknown as typeof fetch);
      expect(item?.kind).toBe(target.kind);
      expect(item?.channelName).toBeNull();
      const route = target.kind === "CHANNEL" ? "channels" : "handles";
      expect(fetcher.mock.calls[0][0]).toBe(
        SYNTHETIC_HTTP_PATH + "/" + route + "/" + encodeURIComponent(target.id));
    }
  });

  it("fails closed on wrong identity/provenance/header/content-type/error/redirect", async () => {
    const wrong = [
      valid(CHANNEL),
      new Response(JSON.stringify(simulateOfflineMetadataBackend(VIDEO)),
        { status: 200, headers: { "Content-Type": "application/json" } }),
      new Response(JSON.stringify(simulateOfflineMetadataBackend(VIDEO)),
        { status: 200, headers: { "Content-Type": "text/plain",
          "X-YOUTOPIA-Synthetic": "test-only" } }),
      new Response("unavailable", { status: 503,
        headers: { "Content-Type": "application/json",
          "X-YOUTOPIA-Synthetic": "test-only" } }),
      new Response(JSON.stringify({
        ...simulateOfflineMetadataBackend(VIDEO),
        record: { ...simulateOfflineMetadataBackend(VIDEO)?.record,
          sourceAuthenticated: true },
      }), { status: 200, headers: { "Content-Type": "application/json",
        "X-YOUTOPIA-Synthetic": "test-only" } }),
      new Response("x".repeat(SYNTHETIC_HTTP_MAX_BYTES + 1), {
        headers: { "Content-Type": "application/json",
          "X-YOUTOPIA-Synthetic": "test-only" },
      }),
    ];
    for (const response of wrong) {
      const fetcher = vi.fn(async () => response);
      expect(await fetchSyntheticHttpMetadata(VIDEO,
        new AbortController().signal, fetcher as unknown as typeof fetch)).toBeNull();
    }
  });

  it("does not attempt a request for invalid identities or aborted signal", async () => {
    const fetcher = vi.fn(async () => valid(VIDEO));
    const abort = new AbortController();
    abort.abort();
    expect(await fetchSyntheticHttpMetadata(VIDEO,abort.signal,
      fetcher as unknown as typeof fetch)).toBeNull();
    expect(await fetchSyntheticHttpMetadata(
      {kind:"VIDEO",id:"not-a-canonical-id"},new AbortController().signal,
      fetcher as unknown as typeof fetch)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
