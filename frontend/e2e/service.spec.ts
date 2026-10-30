import { expect, test, type Page } from "@playwright/test";
test.describe("real isolated Spring/PostgreSQL/Redis browser flow", () => {
  test.skip(
    process.env.YOUTOPIA_REAL_E2E !== "true",
    "Requires the explicit isolated packaged-JAR runner",
  );
  test("signup, real login, search, detail, observed charts, settings, logout and account switching", async ({
    page,
  }) => {
    const password = "synthetic browser member password 1234",
      email = "web-" + Date.now() + "@example.invalid";
    await page.goto("/login");
    await page.getByRole("button", { name: "다크", exact: true }).click();
    async function signup(address: string) {
      await page.getByRole("button", { name: "회원가입하기" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("이메일", { exact: true }).fill(address);
      await dialog
        .getByLabel("비밀번호 (15~128자)", { exact: true })
        .fill(password);
      await dialog.getByLabel("비밀번호 확인", { exact: true }).fill(password);
      await dialog
        .getByRole("button", { name: "회원가입", exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
    }
    async function login(address: string) {
      await page.getByLabel("이메일 주소", { exact: true }).fill(address);
      await page.getByLabel("비밀번호", { exact: true }).fill(password);
      await page.getByRole("button", { name: "로그인", exact: true }).click();
    }
    await signup(email);
    await login(email);
    await expect(
      page.getByRole("heading", { name: "게임 활동 현황", exact: true }),
    ).toBeVisible();
    const cookie = (await page.context().cookies()).find(
      (c) => c.name === "YOUTOPIA_SESSION",
    );
    expect(cookie?.secure).toBe(true);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    await page.getByRole("link", { name: "게임 탐색", exact: true }).click();
    await expect(
      page.getByRole("row", { name: "Browser Counter 상세 보기" }),
    ).toContainText("개발사 정보 없음");
    await page.goto("/games?page=1&size=1");
    // Public content can render before the cookie session has been restored.
    await expect(page.getByRole("button", { name: "로그아웃", exact: true })).toBeVisible();
    const sorted = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/events" &&
        r.request().postDataJSON()?.eventType === "SORT_CHANGED",
    );
    await page
      .getByRole("combobox", { name: "정렬", exact: true })
      .selectOption("currentCcu");
    expect((await sorted).status()).toBe(204);
    await expect(page).toHaveURL(/page=0/);
    const filtered = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/events" &&
        r.request().postDataJSON()?.eventType === "FILTER_CHANGED",
    );
    await page
      .getByRole("combobox", { name: "플랫폼", exact: true })
      .selectOption("STEAM");
    expect((await filtered).status()).toBe(204);
    await page.getByLabel("게임명 검색").fill("Arena");
    const recorded = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/events" &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.eventType === "SEARCH_EXECUTED",
    );
    await page.getByRole("button", { name: "검색", exact: true }).click();
    expect((await recorded).status()).toBe(204);
    await expect(
      page.getByRole("link", { name: "Browser Arena", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browser Counter", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Browser Arena", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Browser Arena", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".insight-metric-card")
        .filter({ hasText: "현재 관측 CCU" })
        .getByText("0", { exact: true }),
    ).toBeVisible();
    const analysis = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/events" &&
        r.request().postDataJSON()?.eventType === "ANALYSIS_VIEW",
    );
    await page.getByRole("link", { name: "Steam 분석 →" }).click();
    expect((await analysis).status()).toBe(204);
    const chart = page.getByRole("group", { name: "Steam CCU 관측점 탐색" });
    await expect(chart).toBeVisible();
    await chart.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("output")).toContainText("110명");
    expect(
      await page
        .getByRole("option", { name: "90일 · 미지원" })
        .evaluate((el) => (el as HTMLOptionElement).disabled),
    ).toBe(true);
    expect(
      (await page.request.get("/api/v1/steam/apps/570/ccu?days=90")).status(),
    ).toBe(400);
    const periodChanged = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/events" &&
        r.request().postDataJSON()?.eventType === "PERIOD_CHANGED",
    );
    await page
      .getByRole("combobox", { name: "관측 기간", exact: true })
      .selectOption("30");
    expect((await periodChanged).status()).toBe(204);
    await page.getByRole("link", { name: "Steam 차트", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "01 · 3주간 게임별 주간 판매 순위" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "08 · TOP20 진입 및 매주 유지" }),
    ).toBeVisible();
    await page.getByLabel("비교할 Steam app ID").fill("570");
    await page.getByRole("button", { name: "관측 비교" }).click();
    await expect(
      page.getByRole("heading", { name: "13 · 정확히 24시간 전 대비 게임 수" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "YouTube 관측", exact: true }).click();
    await page.getByLabel("YouTube 영상 ID").fill("abcdefghijk");
    await page.getByRole("button", { name: "실제 영상 관측 조회" }).click();
    await expect(
      page.getByRole("heading", { name: "10 · 영상 최초·마지막 누적 조회수" }),
    ).toBeVisible();
    await expect(page.getByText(/차이 200/)).toBeVisible();
    await expect(page.getByText(/0%를 뜻하지 않습니다/)).toBeVisible();
    await page.getByRole("button", { name: "설정", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: email, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "라이트", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("button", { name: "라이트", exact: true }).last(),
    ).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "라이트", exact: true }).last(),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "운영 접수 보류" }),
    ).toBeDisabled();
    await page.getByLabel("현재 비밀번호 확인", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "복구코드 재발급", exact: true })
      .click();
    await expect(page.locator(".recovery-codes li")).toHaveCount(8);
    const recoveryCode = await page
      .locator(".recovery-codes code")
      .first()
      .textContent();
    await page.getByRole("button", { name: "보관 완료 · 코드 숨기기" }).click();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      await page.evaluate(() => localStorage.getItem("yutopia-theme")),
    ).toBe("dark");
    await page
      .getByRole("button", { name: "비밀번호 찾기", exact: true })
      .click();
    const reset = page.getByRole("dialog");
    await reset.getByLabel("이메일", { exact: true }).fill(email);
    await reset
      .getByLabel("비밀번호 (15~128자)", { exact: true })
      .fill("new synthetic browser password 1234");
    await reset
      .getByLabel("비밀번호 확인", { exact: true })
      .fill("new synthetic browser password 1234");
    await reset
      .getByLabel("일회용 복구코드", { exact: true })
      .fill(recoveryCode!);
    await reset
      .getByRole("button", { name: "비밀번호 변경", exact: true })
      .click();
    await expect(reset).not.toBeVisible();
    await page.getByLabel("이메일 주소", { exact: true }).fill(email);
    await page
      .getByLabel("비밀번호", { exact: true })
      .fill("new synthetic browser password 1234");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "내 계정 · 설정", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "라이트", exact: true }).last(),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);

    const other = "other-" + Date.now() + "@example.invalid";
    await signup(other);
    await login(other);
    await page.getByRole("button", { name: "설정", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: other, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "시스템", exact: true }).last(),
    ).toHaveAttribute("aria-pressed", "true");
    await page.goto("/games/steam:999999999/youtube");
    await expect(
      page.getByText("데이터를 찾을 수 없습니다.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("YouTube 영상 ID", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page.getByRole("link", { name: "로그인", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/games\/steam:999999999\/youtube$/);
  });
  test("guest browses and searches public observations, then personal settings require login", async ({page}) => {
    await page.goto("/games");
    await expect(page.getByRole("heading", {name:"관측 게임 탐색",exact:true})).toBeVisible();
    await expect(page.getByRole("link", {name:"로그인",exact:true})).toBeVisible();
    await page.getByLabel("게임명 검색").fill("Arena");
    await page.getByRole("button", {name:"검색",exact:true}).click();
    await page.getByRole("link", {name:"Browser Arena",exact:true}).click();
    await expect(page.getByRole("heading", {name:"Browser Arena",exact:true})).toBeVisible();
    await page.getByRole("link", {name:"Steam 분석 →"}).click();
    await expect(page.getByRole("group", {name:"Steam CCU 관측점 탐색"})).toBeVisible();
    await page.goto("/charts/steam");
    await expect(page.getByRole("heading", {name:"Steam 트렌드 차트",exact:true})).toBeVisible();
    await page.goto("/charts/youtube");
    await expect(page.getByLabel("YouTube 영상 ID",{exact:true})).toBeVisible();
    await page.goto("/games/steam:570/youtube");
    await expect(page.getByRole("heading",{name:"Browser Arena · YouTube",exact:true})).toBeVisible();
    await page.getByLabel("YouTube 영상 ID",{exact:true}).fill("abcdefghijk");
    await page.getByRole("button",{name:"실제 영상 관측 조회",exact:true}).click();
    await expect(page.getByRole("group",{name:"10 · 영상 최초·마지막 누적 조회수 관측점 탐색"})).toBeVisible();
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
  test("anonymous public reads succeed while personal routes and tokenless writes stay protected", async ({
    request,
  }) => {
    const denied = await request.post("/api/v1/auth/login", {
      data: {
        login: "fake@example.invalid",
        password: "synthetic test password",
      },
    });
    expect(denied.status()).toBe(403);
    expect((await denied.json()).code).toBe("CSRF_INVALID");
    expect((await request.get("/api/v1/games")).status()).toBe(200);
    expect((await request.get("/api/v1/me/settings")).status()).toBe(401);
    expect((await request.get("/api/v1/admin/members")).status()).toBe(401);
    expect((await request.post("/api/v1/games/search", {data:{q:"Arena",clientEventId:crypto.randomUUID()}})).status()).toBe(403);
  });
  test("administrator uses separate realm and sees only masked member fields", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await page
      .getByLabel("관리자 로그인명", { exact: true })
      .fill("browser_operator");
    await page
      .getByLabel("비밀번호", { exact: true })
      .fill("synthetic browser operator password 1234");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "관리자 · 서비스 이용 현황" }),
    ).toBeVisible();
    await expect(
      page.getByText("최근 5분 활동 세션", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "회원 조회", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "관리자 · 회원 조회" }),
    ).toBeVisible();
    await expect(page.locator(".game-table")).toContainText("*");
    await expect(page.locator(".game-table")).not.toContainText(
      "password_hash",
    );
    await page.goto("/games");
    await expect(page.getByRole("heading", { name: "관측 게임 탐색", exact: true })).toBeVisible();
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "접근 권한이 없습니다." }),
    ).toBeVisible();
  });
});

async function stubSession(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/me")
      return route.fulfill({
        json: {
          kind: "USER",
          id: "00000000-0000-0000-0000-000000000001",
          emailVerified: false,
        },
      });
    if (path === "/api/v1/me/settings")
      return route.fulfill({
        json: { version: 0, values: { theme: "system" } },
      });
    return route.fulfill({ status: 503, json: { code: "SOURCE_UNAVAILABLE" } });
  });
}
test("stubbed source outage remains an error without fake game fallback", async ({
  page,
}) => {
  await stubSession(page);
  await page.goto("/games");
  await expect(page.getByRole("alert")).toContainText(
    "데이터를 불러오지 못했습니다",
  );
  await expect(
    page.getByRole("link", { name: "Browser Arena", exact: true }),
  ).toHaveCount(0);
});
test("stubbed empty response is distinct from error and has no chart interaction", async ({
  page,
}) => {
  await stubSession(page);
  await page.route("**/api/v1/games?*", (route) =>
    route.fulfill({
      json: {
        content: [],
        page: { number: 0, size: 20, totalElements: 0, totalPages: 0 },
        asOf: "2026-10-30T00:00:00Z",
        freshness: "UNASSESSED",
        dataStatus: "EMPTY",
      },
    }),
  );
  await page.goto("/games");
  await expect(page.getByText("표시할 관측 데이터가 없습니다.")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
