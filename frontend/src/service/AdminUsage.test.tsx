import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ServiceApp } from "./ServiceApp";
import { serviceApi } from "./api";

afterEach(() => vi.restoreAllMocks());

it("shows date-filtered signups when usage is partial and keeps the current signup window separate", async () => {
  vi.spyOn(serviceApi, "me").mockResolvedValue({
    kind: "ADMIN", id: "admin", emailVerified: false, authVersion: "1", adminGeneration: "1",
  });
  const usage = {
    from: "2026-11-01", to: "2026-11-07", aggregationTimezone: "Asia/Seoul", dataStatus: "PARTIAL",
    activeSessionLabel: "최근 5분 활동 세션", activeSessions: 1, activeSessionAsOf: "2026-11-27T00:00:00Z",
    activeUsers: { dau: null, wau: null, mau: null },
    signupWindows: { today: 2, last7KstDays: 4, last30KstDays: 9, asOfDayKst: "2026-11-27" },
    signups: [{ dayKst: "2026-11-03", count: 5 }],
    daily: [], routes: [], games: [], actions: [], searchConversion: [], observedVisitors: [],
  };
  vi.spyOn(serviceApi, "request").mockImplementation(async (path) => {
    if (path === "/api/v1/admin/usage?") return usage;
    if (path === "/api/v1/admin/usage?to=2026-10-01") {
      return { ...usage, from: "2026-09-25", to: "2026-10-01", dataStatus: "EMPTY", signups: [] };
    }
    throw new Error("Unexpected request: " + path);
  });
  window.history.replaceState(null, "", "/admin/analytics");
  render(<ServiceApp />);
  expect(await screen.findByText(/선택 기간에는 가입 집계만/)).toBeVisible();
  const table = screen.getByRole("table", { name: "선택 기간 일별 가입" });
  expect(within(table).getByRole("row", { name: "2026-11-03 5" })).toBeVisible();
  expect(screen.getByText("2 / 4 / 9")).toBeVisible();
  fireEvent.change(screen.getByLabelText("종료일 (KST)"), { target: { value: "2026-10-01" } });
  expect(await screen.findByText(/선택 기간에 집계된 이용 활동과 가입 이력이 없습니다/)).toBeVisible();
  expect(screen.queryByText("2026-11-03")).toBeNull();
  expect(screen.getByText("2026-11-27 KST 기준 · 가입 건수")).toBeVisible();
});
