import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, ServiceApi } from "./api";
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Retry-After": "30" },
  });
afterEach(() => vi.useRealTimers());
describe("same-origin session API contract", () => {
  it("fetches current session CSRF before each write without using bearer tokens", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ token: "synthetic-csrf", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response({ kind: "USER", id: "synthetic-user" }));
    await new ServiceApi(fetcher).login(
      "fake@example.invalid",
      "synthetic test password",
    );
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/auth/csrf");
    const options = fetcher.mock.calls[1][1]!;
    expect(options.credentials).toBe("same-origin");
    expect(options.headers).toMatchObject({ "X-CSRF-TOKEN": "synthetic-csrf" });
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(String(fetcher.mock.calls[0][0])).not.toContain("password");
  });
  it("does not send a mutation after an invalid CSRF response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ token: "x", headerName: "Authorization" }));
    await expect(new ServiceApi(fetcher).logout()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps 429 and Retry-After without automatically replaying a mutation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ token: "test", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response({ code: "RATE_LIMITED" }, 429));
    await expect(
      new ServiceApi(fetcher).saveTheme(
        "00000000-0000-0000-0000-000000000001",
        2,
        "dark",
      ),
    ).rejects.toMatchObject({ status: 429, retryAfter: "30" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]?.headers).toHaveProperty(
      "X-Youtopia-Account",
    );
  });
  it("does not turn a source failure or malformed response into an empty list", async () => {
    const failing = new ServiceApi(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(response({ code: "SOURCE_UNAVAILABLE" }, 503)),
    );
    await expect(failing.games(new URLSearchParams())).rejects.toBeInstanceOf(
      ApiError,
    );
    const malformed = new ServiceApi(
      vi.fn<typeof fetch>().mockResolvedValue(response({ items: [] })),
    );
    await expect(malformed.games(new URLSearchParams())).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("cancels a timed-out request and reports it without retries", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options!.signal!.addEventListener("abort", () =>
              reject(new DOMException("cancelled", "AbortError")),
            ),
          ),
      );
    const request = new ServiceApi(fetcher, 20).me();
    const assertion = expect(request).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(21);
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("refuses arbitrary origins and keeps native identifiers encoded", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({}));
    const api = new ServiceApi(fetcher);
    await expect(api.request("https://example.invalid/api")).rejects.toThrow(
      "Same-origin",
    );
    await api.detail("steam:570");
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/games/steam%3A570");
  });
});
