import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ServiceApp } from "./ServiceApp";
import { serviceApi } from "./api";

const admin = {
  kind: "ADMIN" as const, id: "admin-a", emailVerified: false, authVersion: "1", adminGeneration: "1",
};
const member = {
  userId: "11111111-1111-4111-8111-111111111111", maskedEmail: "s***@example.test",
  accountStatus: "PENDING_DELETION", createdAt: "2026-11-01T00:00:00Z", recoverUntil: null,
};
const query = "synthetic-private-query";

beforeEach(() => {
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.spyOn(serviceApi, "me").mockResolvedValue(admin);
  vi.spyOn(serviceApi, "request").mockImplementation(async (path) => {
    const url = new URL(path, window.location.origin);
    if (url.pathname === "/api/v1/admin/members") {
      const page = Number(url.searchParams.get("page"));
      return { content: [member], page: { number: page, hasNext: page === 0 } };
    }
    if (url.pathname === "/api/v1/admin/members/" + member.userId) return member;
    throw new Error("Unexpected request: " + path);
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function open(path: string) {
  window.history.replaceState(null, "", path);
  return render(<ServiceApp />);
}

function expectPrivateNavigation(path: string) {
  expect(window.location.pathname + window.location.search + window.location.hash).toBe(path);
  expect(JSON.stringify(window.history.state)).not.toContain(query);
  expect(JSON.stringify(localStorage)).not.toContain(query);
  expect(JSON.stringify(sessionStorage)).not.toContain(query);
}

it.each(["/admin/users", "/admin/members"])("preserves directory filters on detail return under %s", async path => {
  open(path);
  fireEvent.change(await screen.findByLabelText("계정 상태"), { target: { value: "PENDING_DELETION" } });
  fireEvent.change(screen.getByLabelText("회원 검색"), { target: { value: query } });
  fireEvent.click(await screen.findByRole("button", { name: "다음" }));
  const memberLink = await screen.findByRole("link", { name: member.userId });
  expectPrivateNavigation(path);
  fireEvent.click(memberLink);
  const back = await screen.findByRole("link", { name: "← 회원 목록" });
  expectPrivateNavigation(path + "/" + member.userId);
  expect(back).toHaveAttribute("href", path);

  vi.mocked(serviceApi.request).mockClear();
  fireEvent.click(back);
  await screen.findByRole("link", { name: member.userId });
  expect(screen.getByLabelText("회원 검색")).toHaveValue(query);
  expect(screen.getByLabelText("계정 상태")).toHaveValue("PENDING_DELETION");
  expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  expect(serviceApi.request).toHaveBeenCalledWith(
    "/api/v1/admin/members?page=1&status=PENDING_DELETION&q=" + query, expect.anything(),
  );
  expectPrivateNavigation(path);
});

it("uses default filters on direct detail entry and clears search after leaving the directory", async () => {
  open("/admin/members/" + member.userId);
  fireEvent.click(await screen.findByRole("link", { name: "← 회원 목록" }));
  expect(await screen.findByLabelText("회원 검색")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("회원 검색"), { target: { value: query } });
  fireEvent.click(screen.getByRole("link", { name: "운영 현황" }));
  await screen.findByRole("heading", { name: "관리자 · 서비스 이용 현황" });
  fireEvent.click(screen.getAllByRole("link", { name: "회원 조회" })[0]);
  expect(await screen.findByLabelText("회원 검색")).toHaveValue("");
});

it("starts the next administrator's session without the previous member search", async () => {
  open("/admin/users");
  fireEvent.change(await screen.findByLabelText("회원 검색"), { target: { value: query } });
  await screen.findByRole("link", { name: member.userId });
  vi.mocked(serviceApi.request).mockClear();
  vi.mocked(serviceApi.me).mockResolvedValue({ ...admin, id: "admin-b" });
  await act(async () => { window.dispatchEvent(new Event("youtopia-session-changed")); });
  await waitFor(() => expect(screen.getByLabelText("회원 검색")).toHaveValue(""));
  expect(serviceApi.request).toHaveBeenCalledWith("/api/v1/admin/members?page=0&status=ACTIVE&q=", expect.anything());
  expect(vi.mocked(serviceApi.request).mock.calls.every(([path]) => !path.includes(query))).toBe(true);
});
