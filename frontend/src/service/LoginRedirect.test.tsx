import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ServiceApp } from "./ServiceApp";
import { ApiError, serviceApi, type Identity } from "./api";

const member: Identity = { kind: "USER", id: "11111111-1111-4111-8111-111111111111", emailVerified: false, authVersion: "1" };
const admin: Identity = { kind: "ADMIN", id: "22222222-2222-4222-8222-222222222222", emailVerified: false, authVersion: "1", adminGeneration: "1" };
const homes = { USER: { path: "/dashboard", title: "게임 활동 현황" }, ADMIN: { path: "/admin", title: "관리자 · 서비스 이용 현황" } };
const emptyMetric = { availability: "UNAVAILABLE", value: null, observedAt: null };
const identity = (kind: "USER" | "ADMIN") => kind === "ADMIN" ? admin : member;

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "false");
  vi.spyOn(serviceApi, "me").mockRejectedValue(new ApiError(401, "AUTHENTICATION_REQUIRED"));
  vi.spyOn(serviceApi, "login").mockResolvedValue(member);
  vi.spyOn(serviceApi, "logout").mockResolvedValue(undefined);
  vi.spyOn(serviceApi, "settings").mockResolvedValue({ version: 0, values: { theme: "system" } });
  vi.spyOn(serviceApi, "request").mockRejectedValue(new ApiError(503, "SOURCE_UNAVAILABLE"));
  vi.spyOn(serviceApi, "games").mockResolvedValue({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 }, asOf: "2026-11-27T00:00:00Z", dataStatus: "EMPTY", freshness: "UNASSESSED" });
  vi.spyOn(serviceApi, "classifications").mockResolvedValue({ state: "EMPTY", options: [], meaning: "" });
  vi.spyOn(serviceApi, "steamTags").mockResolvedValue({ state: "EMPTY", options: [], meaning: "" });
  vi.spyOn(serviceApi, "detail").mockResolvedValue({
    game: { gameId: "steam:570", steamAppId: 570, name: "Synthetic Arena", developers: { availability: "UNAVAILABLE", value: null }, releaseAt: { availability: "UNAVAILABLE", value: null }, steamConnection: "UNAVAILABLE", youtubeConnection: "UNAVAILABLE", currentCcu: emptyMetric, peak24h: emptyMetric, newYoutubeVideos: emptyMetric, freshness: "UNASSESSED" },
    asOf: "2026-11-27T00:00:00Z", youtubePreviewAvailability: "UNAVAILABLE",
    steamPreview: { appId: 570, days: 30, dataStatus: "EMPTY", freshnessStatus: "UNASSESSED", lastObservedAt: null, points: [] },
  });
  vi.spyOn(serviceApi, "publications").mockResolvedValue({ appId: 570, days: 7, asOf: "2026-11-27T00:00:00Z", timezone: "Asia/Seoul", dataStatus: "PENDING_CONTRACT", coverage: "UNASSESSED", missingPublishedAt: null, selectedDate: "2026-11-27", points: [], videos: null });
  vi.spyOn(serviceApi, "associations").mockResolvedValue({ relevanceVerification: "UNVERIFIED", accelerationAvailability: "UNAVAILABLE", accelerationReason: "", content: [] });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function open(path: string, from?: unknown) {
  window.history.replaceState({ key: crypto.randomUUID(), usr: from === undefined ? null : { from } }, "", path);
  return render(<ServiceApp />);
}
async function submit(kind: "USER" | "ADMIN") {
  const login = kind === "ADMIN" ? "synthetic-operator" : "synthetic@example.test";
  fireEvent.change(await screen.findByLabelText(kind === "ADMIN" ? "관리자 로그인명" : "이메일 주소"), { target: { value: login } });
  fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), { target: { value: "synthetic test password 1234" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
}
async function expectHome(kind: "USER" | "ADMIN") {
  await screen.findByRole("heading", { name: homes[kind].title });
  expect(window.location.pathname + window.location.search).toBe(homes[kind].path);
  expect(screen.getByRole("button", { name: "로그아웃" })).toBeVisible();
}

it.each(["USER", "ADMIN"] as const)("sends a successful %s login to its realm home when no return path exists", async kind => {
  vi.mocked(serviceApi.login).mockResolvedValue(identity(kind));
  open(kind === "ADMIN" ? "/admin/login" : "/login");
  await submit(kind);
  await expectHome(kind);
  expect(serviceApi.login).toHaveBeenCalledWith(kind === "ADMIN" ? "synthetic-operator" : "synthetic@example.test", "synthetic test password 1234", kind === "ADMIN");
});

it.each([
  ["USER", "/login"], ["USER", "/admin/login"], ["USER", "/signup"],
  ["ADMIN", "/login"], ["ADMIN", "/admin/login"], ["ADMIN", "/signup"],
] as const)("uses the existing %s identity on %s without authenticating into another realm", async (kind, path) => {
  vi.mocked(serviceApi.me).mockResolvedValue(identity(kind));
  open(path);
  await expectHome(kind);
  expect(serviceApi.login).not.toHaveBeenCalled();
  expect(serviceApi.logout).not.toHaveBeenCalled();
});

it.each([
  ["USER", "/games?q=Arena&days=7&page=2", "관측 게임 탐색"],
  ["USER", "/games/steam:570/youtube?days=7", "Synthetic Arena · YouTube"],
  ["USER", "/settings", "내 계정 · 설정"],
  ["ADMIN", "/admin/users?page=2", "관리자 · 회원 조회"],
  ["ADMIN", "/admin/members/11111111-1111-4111-8111-111111111111", "관리자 · 회원 상세"],
  ["ADMIN", "/admin/analytics?days=7", "관리자 · 서비스 이용 현황"],
  ["ADMIN", "/games?days=7", "관측 게임 탐색"],
] as const)("retains the allowed %s destination %s including its query", async (kind, from, title) => {
  vi.mocked(serviceApi.me).mockResolvedValue(identity(kind));
  open(kind === "ADMIN" ? "/admin/login" : "/login", from);
  await screen.findByRole("heading", { name: title });
  expect(window.location.pathname + window.location.search).toBe(from);
});

it.each([
  ["USER", "/admin"], ["USER", "/admin/users?page=2"], ["USER", "/%61dmin/users"],
  ["ADMIN", "/settings"], ["USER", "https://example.invalid/games"], ["ADMIN", "//example.invalid/admin"],
  ["USER", "/games/../admin"], ["USER", "/games/%2e%2e/admin"], ["ADMIN", "/admin/users/../../settings"],
  ["USER", "/games\\..\\admin"], ["USER", "/charts/unknown"], ["ADMIN", "/admin/login"],
  ["USER", "javascript:alert(1)"], ["ADMIN", { pathname: "/admin/users" }],
] as const)("rejects unsafe, unregistered or cross-realm %s return state %j", async (kind, from) => {
  vi.mocked(serviceApi.me).mockResolvedValue(identity(kind));
  open(kind === "ADMIN" ? "/admin/login" : "/login", from);
  await expectHome(kind);
});

it("keeps the protected USER return path after an actual login submission", async () => {
  open("/settings");
  await submit("USER");
  await screen.findByRole("heading", { name: "내 계정 · 설정" });
  expect(window.location.pathname).toBe("/settings");
});

it("does not redirect a rejected login or failed session confirmation to a successful home", async () => {
  vi.mocked(serviceApi.login).mockRejectedValue(new ApiError(401, "AUTHENTICATION_REQUIRED"));
  open("/login");
  await submit("USER");
  await waitFor(() => expect(serviceApi.login).toHaveBeenCalled());
  expect(await screen.findByText("로그인 정보 또는 세션을 확인해 주세요.")).toBeVisible();
  expect(window.location.pathname).toBe("/login");
  expect(screen.queryByRole("heading", { name: "게임 활동 현황" })).toBeNull();
});
