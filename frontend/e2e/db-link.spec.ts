import { expect, test, type Page } from "@playwright/test";
import type { RankReport } from "../src/service/api";

// Synthetic HTTP contracts only; these tests do not connect to an operating DB.
const asOf = "2026-11-27T12:00:00Z";
const game = {
  gameId: "steam:570", steamAppId: 570, name: "Synthetic Integration Game",
  developers: { availability: "AVAILABLE", value: ["Synthetic Studio"] },
  releaseAt: { availability: "UNAVAILABLE", value: null },
  steamConnection: "CONNECTED", youtubeConnection: "CONNECTED",
  currentCcu: { availability: "AVAILABLE", value: 0, observedAt: asOf },
  peak24h: { availability: "AVAILABLE", value: 12, observedAt: asOf },
  newYoutubeVideos: { availability: "AVAILABLE", value: 2, observedAt: asOf },
  reviewAvailability: "UNAVAILABLE", analysisAvailability: "UNAVAILABLE",
  gameEventAvailability: "UNAVAILABLE", freshness: "UNASSESSED",
};
const detail = {
  game, asOf, youtubePreviewAvailability: "AVAILABLE",
  steamPreview: { appId: 570, days: 30, dataStatus: "AVAILABLE", freshnessStatus: "UNASSESSED", lastObservedAt: asOf,
    points: [{ scheduledAt: asOf, observedAt: asOf, playerCount: 0 }] },
};
const video = {
  from: "2026-11-21T12:00:00Z", to: asOf, mappingBasis: "NATIVE_VIDEO_ID", freshness: "UNASSESSED",
  comparison: { availability: "AVAILABLE", reason: null, elapsedSeconds: 3600, cumulativeDifference: 10,
    first: { views: 100, slot: "2026-11-27T10:00:00Z" }, last: { views: 110, slot: "2026-11-27T11:00:00Z" } },
  observations: [
    { id: 1, slot: "2026-11-27T10:00:00Z", receivedAt: "2026-11-27T10:00:01Z", views: 100 },
    { id: 2, slot: "2026-11-27T11:00:00Z", receivedAt: "2026-11-27T11:00:01Z", views: 110 },
  ],
};

async function contracts(page: Page, options: { member?: boolean; legacy?: boolean; associationStatus?: number } = {}) {
  const calls: URL[] = [];
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    calls.push(url);
    const path = decodeURIComponent(url.pathname);
    if (path === "/api/v1/auth/me") return options.member
      ? route.fulfill({ json: { kind: "USER", id: "11111111-1111-4111-8111-111111111111", emailVerified: false, authVersion: "1" } })
      : route.fulfill({ status: 401, json: { code: "AUTHENTICATION_REQUIRED" } });
    if (path === "/api/v1/me/settings") return route.fulfill({ json: { version: 0, values: { theme: "system" } } });
    if (path === "/api/v1/auth/csrf") return route.fulfill({ json: { token: "synthetic-csrf", headerName: "X-CSRF-TOKEN" } });
    if (["/api/v1/auth/activity", "/api/v1/events"].includes(path)) return route.fulfill({ status: 204 });
    if (path === "/api/v1/games") return route.fulfill({ json: { content: [game], page: { number: Number(url.searchParams.get("page") ?? 0), size: 20, totalElements: 1, totalPages: 1 }, asOf, dataStatus: "AVAILABLE", freshness: "UNASSESSED" } });
    if (path === "/api/v1/games/classifications") return route.fulfill({ json: { state: "AVAILABLE", options: [], meaning: "synthetic" } });
    if (path === "/api/v1/games/steam-tags") return route.fulfill({ json: { state: "AVAILABLE", options: [], meaning: "synthetic" } });
    if (path === "/api/v1/games/steam:570") return route.fulfill({ json: detail });
    if (path === "/api/v1/games/steam:570/youtube-publications") {
      const scope = url.searchParams.get("scope") ?? "date";
      const pageNumber = Number(url.searchParams.get("page") ?? 0);
      return route.fulfill({ json: {
        appId: 570, days: Number(url.searchParams.get("days") ?? 30), asOf, timezone: "Asia/Seoul",
        dataStatus: "AVAILABLE", coverage: "UNASSESSED", missingPublishedAt: 1,
        selectedDate: scope === "period" ? null : url.searchParams.get("date") ?? "2026-11-27",
        videoScope: scope,
        ...(!options.legacy ? { summary: { population: "QUERY_ASSOCIATED_DISTINCT_VIDEOS_DISCOVERED_BY_AS_OF", observedVideos: 4, publishedVideos: 2, periodVideos: 2, missingPublishedAt: 1, futurePublishedAt: 1, latestFirstObservedAt: asOf } } : {}),
        points: [{ date: "2026-11-26", observedVideos: 1, inProgress: false }, { date: "2026-11-27", observedVideos: 1, inProgress: true }],
        videos: { content: [{ videoId: "abcdefghijk", title: "Synthetic observed video", publishedAt: "2026-11-26T01:00:00Z", firstObservedAt: "2026-11-26T02:00:00Z" }],
          page: { number: pageNumber, size: 1, totalElements: 2, hasNext: pageNumber === 0 } },
      } });
    }
    if (path === "/api/v1/youtube/videos/abcdefghijk/observations") return route.fulfill({ json: video });
    if (path === "/api/v1/charts/youtube/query-associations") return options.associationStatus
      ? route.fulfill({ status: options.associationStatus, json: { code: "NOT_FOUND" } })
      : route.fulfill({ json: { relevanceVerification: "UNASSESSED", accelerationAvailability: "UNAVAILABLE", accelerationReason: "ACCELERATION_INTERVAL_POLICY_PENDING", content: [{ appId: 570, queryAssociatedVideos: 4, comparableVideos: 1, comparableRatio: 0.25 }] } });
    return route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });
  return calls;
}

test("synthetic HTTP: publication URL survives reload, history and native observation drill-down", async ({ page }) => {
  const calls = await contracts(page);
  await page.goto("/games/steam:570/youtube?days=7&videoDate=2026-11-26&videoPage=1");
  await expect(page.getByRole("link", { name: "Synthetic observed video", exact: true })).toBeVisible();
  expect(calls.some(url => url.pathname.endsWith("youtube-publications") && url.searchParams.get("date") === "2026-11-26" && url.searchParams.get("page") === "1")).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "이전 영상", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "이전 영상", exact: true }).click();
  await expect(page).toHaveURL(/videoPage=0/);
  await page.getByRole("combobox", { name: "게시 영상 범위", exact: true }).selectOption("period");
  await expect(page).toHaveURL(/videoScope=period/);
  expect(new URL(page.url()).searchParams.has("videoDate")).toBe(false);
  expect(new URL(page.url()).searchParams.has("videoPage")).toBe(false);
  await expect(page.getByRole("heading", { name: "선택한 7일 게시 영상 · 2개 관측" })).toBeVisible();
  await page.getByRole("link", { name: "저장된 영상 통계 보기", exact: true }).click();
  await expect(page).toHaveURL(/videoId=abcdefghijk&days=7/);
  await expect(page.getByRole("heading", { name: "10 · 영상 최초·마지막 누적 조회수" })).toBeVisible();
  expect(calls.some(url => url.pathname.endsWith("/abcdefghijk/observations") && url.searchParams.get("days") === "7")).toBe(true);
  await page.getByRole("link", { name: "← 게시 영상 목록", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "게시 영상 범위", exact: true })).toHaveValue("period");
  await page.goBack();
  await expect(page.getByLabel("YouTube 영상 ID", { exact: true })).toHaveValue("abcdefghijk");
});

test("synthetic HTTP: recover a missing game page, then clear its search while keeping the filters", async ({ page }) => {
  const calls = await contracts(page);
  const lists: URLSearchParams[] = [];
  await page.route(/\/api\/v1\/games\?/, route => {
    const params = new URL(route.request().url()).searchParams;
    lists.push(params);
    const number = Number(params.get("page") ?? 0);
    return route.fulfill({ json: { content: number ? [] : [game], page: { number, size: 20, totalElements: 1, totalPages: 1 }, asOf, dataStatus: "AVAILABLE", freshness: "UNASSESSED" } });
  });
  await page.goto("/games?days=7&q=Integration&page=3");
  await expect(page.getByText(/조건에 맞는 게임 1개가 있습니다/)).toBeVisible();
  await expect(page.getByText("표시할 관측 데이터가 없습니다.")).toHaveCount(0);
  await page.getByRole("button", { name: "처음", exact: true }).click();
  await expect(page.getByRole("link", { name: game.name, exact: true })).toBeVisible();
  expect(lists.at(-1)?.get("q")).toBe("Integration");
  const search = page.getByRole("searchbox", { name: "게임명 검색" });
  await search.fill("");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/games\?days=7&page=0$/);
  await expect.poll(() => lists.at(-1)?.has("q")).toBe(false);
  expect(calls.some(url => url.pathname === "/api/v1/games/search")).toBe(false);
  await page.goBack();
  await expect(search).toHaveValue("Integration");
  await expect(page.getByLabel("데이터 판정 기간")).toHaveValue("7");
});

test("synthetic HTTP: old server does not turn a missing summary into zero", async ({ page }) => {
  await contracts(page, { legacy: true });
  await page.goto("/games/steam:570/youtube?days=7");
  const summary = page.getByRole("region", { name: "YouTube 관측 요약", exact: true });
  await expect(summary.getByText("요약 미제공", { exact: true })).toHaveCount(2);
  await expect(summary.getByText("0개", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Synthetic observed video", exact: true })).toBeVisible();
});

test("synthetic HTTP: confirmed analysis routes keep the game and distinguish unavailable data", async ({ page }) => {
  const calls = await contracts(page);
  for (const [route, title] of [["reactions", "사용자 반응 분석"], ["keywords", "키워드 분석"], ["events", "게임 관련 이벤트"]]) {
    await page.goto(`/games/steam:570/${route}?days=7`);
    await expect(page.getByRole("heading", { name: `Synthetic Integration Game · ${title}`, exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "관측 기간", exact: true })).toHaveValue("7");
    await expect(page.getByText("페이지를 찾을 수 없습니다.")).toHaveCount(0);
    await expect(page.getByText(/원천이 연결되지 않았습니다/).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: `Synthetic Integration Game · ${title}`, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("combobox", { name: "이벤트 유형", exact: true })).toBeDisabled();
  expect(calls.some(url => /\/api\/v1\/.*\/(reactions|keywords|events)$/.test(url.pathname))).toBe(false);
});

test("synthetic HTTP: missing game is an error instead of an unavailable analysis result", async ({ page }) => {
  await contracts(page);
  await page.goto("/games/steam:999999999/reactions");
  await expect(page.getByRole("alert")).toContainText("요청한 데이터가 없거나 아직 제공되지 않습니다.");
  await expect(page.getByRole("heading", { name: "긍정 반응", exact: true })).toHaveCount(0);
});

test("synthetic HTTP: G11 reaches its existing USER API and preserves feature-off state", async ({ page }) => {
  const calls = await contracts(page, { member: true });
  await page.goto("/games/steam:570/youtube?days=7");
  await expect(page.getByRole("heading", { name: "11 · 검색어 연결 영상과 비교 가능한 영상", exact: true })).toBeVisible();
  expect(calls.some(url => url.pathname.endsWith("query-associations") && url.searchParams.get("appIds") === "570" && url.searchParams.get("days") === "7")).toBe(true);
  await page.route("**/api/v1/charts/youtube/query-associations?*", route => route.fulfill({ status: 404, json: { code: "NOT_FOUND" } }));
  await page.reload();
  await expect(page.getByText("이 조회 기능이 현재 제공되지 않습니다. 연결 영상 0개를 뜻하지 않습니다.")).toBeVisible();
});

test("synthetic HTTP: mobile game detail and YouTube round-trip retains the search URL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await contracts(page);
  await page.goto("/games?q=Synthetic&days=7&page=0");
  await page.getByRole("link", { name: "Synthetic Integration Game", exact: true }).click();
  await page.getByRole("link", { name: "YouTube 관측 →", exact: true }).click();
  await page.getByRole("link", { name: "← 게임 상세", exact: true }).click();
  await page.getByRole("link", { name: "← 게임 목록", exact: true }).click();
  expect(new URL(page.url()).pathname).toBe("/games");
  expect(new URL(page.url()).searchParams.get("q")).toBe("Synthetic");
  expect(new URL(page.url()).searchParams.get("days")).toBe("7");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/db-link/mobile-games.png", fullPage: true });
});

for (const theme of ["dark", "light"] as const) {
  test(`synthetic HTTP: mobile ${theme} Steam rank table scrolls within its card`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await contracts(page);
    const starts = ["2026-11-02T00:00:00Z", "2026-11-09T00:00:00Z", "2026-11-16T00:00:00Z"];
    const pairs = [
      { appId: 570, name: "Synthetic Arena", krPosition: 8, unspecifiedPosition: 9, absoluteGap: 1 },
      { appId: 730, name: "Synthetic Counter", krPosition: 22, unspecifiedPosition: 23, absoluteGap: 1 },
      { appId: 440, name: "Synthetic Indie", krPosition: 32, unspecifiedPosition: 33, absoluteGap: 1 },
    ];
    const region = { country: "KR", availability: "AVAILABLE", comparable: 3, uncomparable: 0, up: 1, down: 2, same: 0, upRatio: 1 / 3, downRatio: 2 / 3, sameRatio: 0, deltaHistogram: { "1": 1, "-1": 2 }, topRisers: [], topFallers: [] };
    const report: RankReport = {
      source: "weekly_synthetic", category: "sales", asOf, freshness: "UNASSESSED", calculationVersion: "synthetic",
      charts: {
        rankOneAtTop: true,
        weeks: starts.map(periodStart => ({ periodStart, kr: region, unspecified: { ...region, country: "UNSPECIFIED" }, pairAvailability: "AVAILABLE", pairs, largestGaps: pairs })),
        lastThreeWeekTrends: [{ appId: 570, name: "Synthetic Arena", country: "KR", points: starts.map((periodStart, i) => ({ periodStart, position: 10 - i })) }],
        top20Continuity: [],
      },
    };
    await page.route("**/api/v1/charts/steam/ranking-periods", route => route.fulfill({ json: {
      dataStatus: "AVAILABLE", content: starts.map((start, i) => ({ source: report.source, category: report.category, start, end: starts[i + 1] ?? "2026-11-23T00:00:00Z" })),
    } }));
    await page.route("**/api/v1/charts/steam/rankings?*", route => route.fulfill({ json: report }));
    await page.route("**/api/v1/charts/steam/app-types", route => route.fulfill({ json: {
      asOf, dataStatus: "AVAILABLE", composition: { total: 3, games: 2, nonGames: 1, unknown: 0, gameRatio: 2 / 3, nonGameRatio: 1 / 3, unknownRatio: 0 },
    } }));
    await page.goto("/charts/steam");
    await page.getByRole("button", { name: theme === "dark" ? "다크" : "라이트", exact: true }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const panel = page.getByRole("region", { name: "지역별 원순위 비교", exact: true });
    await expect(panel.getByRole("row")).toHaveCount(4);
    for (const pair of pairs) {
      const row = panel.getByRole("row", { name: `${pair.name} ${pair.krPosition}위 ${pair.unspecifiedPosition}위 ${pair.absoluteGap}`, exact: true });
      await expect(row).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const scroller = panel.getByRole("region", { name: "지역별 원순위 비교 가로 스크롤", exact: true });
    await expect(scroller).toHaveAttribute("tabindex", "0");
    expect(await scroller.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await scroller.focus();
    await expect(scroller).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => scroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
