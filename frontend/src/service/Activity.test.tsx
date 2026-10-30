import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useInteractionEvents, usePageView } from "./Activity";
import { ServiceSessionContext } from "./SessionProvider";
import { serviceApi } from "./api";

function Probe({
  kind = "USER",
  ready = true,
  generation = 1,
}: {
  kind?: "USER" | "ADMIN" | "GUEST";
  ready?: boolean;
  generation?: number;
}) {
  return (
    <ServiceSessionContext.Provider
      value={{
        status: kind === "GUEST" ? "guest" : "authenticated",
        identity:
          kind === "GUEST"
            ? null
            : {
                kind,
                id: "00000000-0000-0000-0000-000000000001",
                emailVerified: false,
              },
        generation,
        refresh: async () => {},
        login: async () => {},
        logout: async () => {},
      }}
    >
      <MemoryRouter>
        <Control ready={ready} />
      </MemoryRouter>
    </ServiceSessionContext.Provider>
  );
}
function Control({ ready }: { ready: boolean }) {
  const record = useInteractionEvents();
  usePageView("analysis.steam", ready, 570, "STEAM");
  return (
    <button
      onClick={() =>
        record({
          type: "SORT_CHANGED",
          action: "games.sort.change",
          properties: { sortKey: "currentCcu", direction: "DESC" },
        })
      }
    >
      정렬 실행
    </button>
  );
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("records approved user interactions without a keyword or passive heartbeat, and deduplicates a rendered analysis", () => {
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "true");
  const request = vi.spyOn(serviceApi, "request").mockResolvedValue(undefined);
  const ui = render(<Probe />);
  expect(request).toHaveBeenCalledTimes(2);
  ui.rerender(<Probe />);
  expect(request).toHaveBeenCalledTimes(2);
  ui.unmount();
  render(<Probe generation={2} />);
  expect(request).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button"));
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[2][1]).toMatchObject({
    account: "00000000-0000-0000-0000-000000000001",
    body: {
      eventType: "SORT_CHANGED",
      actionKey: "games.sort.change",
      properties: { sortKey: "currentCcu", direction: "DESC" },
    },
  });
  expect(JSON.stringify(request.mock.calls)).not.toContain("keyword");
});
it.each(["ADMIN"] as const)(
  "excludes %s from visitor events",
  (kind) => {
    vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "true");
    const request = vi
      .spyOn(serviceApi, "request")
      .mockResolvedValue(undefined);
    render(<Probe kind={kind} />);
    fireEvent.click(screen.getByRole("button"));
    expect(request).not.toHaveBeenCalled();
  },
);
it("records opted-in guest observations without a member account or an auth heartbeat", () => {
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "true");
  const request = vi.spyOn(serviceApi, "request").mockResolvedValue(undefined);
  render(<Probe kind="GUEST" />);
  fireEvent.click(screen.getByRole("button"));
  expect(request).toHaveBeenCalledTimes(3);
  for (const [path, options] of request.mock.calls) {
    expect(path).toBe("/api/v1/events");
    expect(options?.account).toBeUndefined();
  }
});
it("does not collect when product events are disabled or an analysis has not loaded", () => {
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "false");
  const request = vi.spyOn(serviceApi, "request").mockResolvedValue(undefined);
  const ui = render(<Probe ready={false} />);
  fireEvent.click(screen.getByRole("button"));
  expect(request).not.toHaveBeenCalled();
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "true");
  ui.rerender(<Probe ready={false} />);
  expect(request).not.toHaveBeenCalled();
});
