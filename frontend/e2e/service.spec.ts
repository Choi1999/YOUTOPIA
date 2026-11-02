import { expect, test, type Page } from "@playwright/test";
test.describe("real isolated Spring/PostgreSQL/Redis browser flow", () => {
  test.skip(
    process.env.YOUTOPIA_REAL_E2E !== "true",
    "Requires the explicit isolated packaged-JAR runner",
  );
  test("guest selects an uncategorized observed weekly source without a category sentinel", async ({page}) => {
    await page.goto("/charts/steam");
    const requested=page.waitForResponse(response=>{
      const url=new URL(response.url());
      return url.pathname==="/api/v1/charts/steam/rankings" && url.searchParams.get("source")==="weekly_uncategorized";
    });
    await page.getByRole("combobox",{name:"관측 원천 / 범주"}).selectOption({label:"weekly_uncategorized / 범주 미지정"});
    const response=await requested;
    expect(response.status()).toBe(200);
    expect(new URL(response.url()).searchParams.has("category")).toBe(false);
    expect((await response.json()).category).toBeNull();
    await expect(page.getByText(/weekly_uncategorized \/ 범주 미지정 · 마지막 선택 주차/)).toBeVisible();
    await expect(page.getByText(/선택 원천의 관측 주간 종료/)).toContainText("KST");
    await expect(page.getByText(/조회 시각/)).toContainText("신선도 판정 전");
    await expect(page.getByText(/순위 게임명은 관측 당시 원천 표기/)).toBeVisible();
    await expect(page.getByRole("heading",{name:"08 · TOP20 진입 및 매주 유지"})).toBeVisible();
    await expect(page.getByRole("link",{name:"로그인",exact:true})).toBeVisible();
  });
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
        .filter({ hasText: "마지막 관측 CCU" })
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
    await page.getByText("보조 도구 · 영상별 통계 관측").click();
    await page.getByLabel("YouTube 영상 ID").fill("abcdefghijk");
    await page.getByRole("button", { name: "실제 영상 관측 조회" }).click();
    await expect(
      page.getByRole("heading", { name: "10 · 영상 최초·마지막 누적 조회수" }),
    ).toBeVisible();
    await expect(page.getByText(/차이 200/)).toBeVisible();
    await expect(page.getByText(/마지막 영상 관측/)).toContainText("신선도 판정 전");
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
    const loggedOut0=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/auth/logout");
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    expect((await loggedOut0).status()).toBe(204);
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
    const loggedOut1=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/auth/logout");
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    expect((await loggedOut1).status()).toBe(204);
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
    const loggedOut2=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/auth/logout");
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    expect((await loggedOut2).status()).toBe(204);
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
    await expect(page.getByLabel("YouTube 영상 ID",{exact:true})).toBeHidden();
    await page.getByText("보조 도구 · 영상별 통계 관측").click();
    await expect(page.getByLabel("YouTube 영상 ID",{exact:true})).toBeVisible();
    await page.goto("/games/steam:570/youtube");
    await expect(page.getByRole("heading",{name:"Browser Arena · YouTube",exact:true})).toBeVisible();
    await expect(page.getByText(/Steam 앱 ID 570 · 게임별 YouTube 연결 미확인/)).toBeVisible();
    await expect(page.getByLabel("YouTube 영상 ID",{exact:true})).toHaveCount(0);
    await expect(page.getByText(/게시 영상 상태 미확인/)).toBeVisible();
    await page.goto("/charts/youtube");
    await page.getByText("보조 도구 · 영상별 통계 관측").click();
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
    await page.reload();
    await expect(page.getByRole("heading", { name: "관리자 · 회원 조회" })).toBeVisible();
    expect((await page.request.get("/api/v1/admin/auth/me")).status()).toBe(200);
    expect((await page.request.get("/api/v1/admin/members")).status()).toBe(200);
    const savedAdminState = await page.context().storageState();
    await page.goto("/games");
    await expect(page.getByRole("heading", { name: "관측 게임 탐색", exact: true })).toBeVisible();
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "접근 권한이 없습니다." }),
    ).toBeVisible();
    await page.goto("/admin");
    const loggedOut3=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/auth/logout");
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    expect((await loggedOut3).status()).toBe(204);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/login$/);
    // Replay the old cookie through an independent browser context after logout.
    const oldContext = await page.context().browser()!.newContext({storageState: savedAdminState});
    expect((await oldContext.request.get(new URL("/api/v1/admin/members", page.url()).href)).status()).toBe(401);
    await oldContext.close();
  });
  test("claimed upper test grade cannot grant administrator access", async ({page}) => {
    await page.goto("/login");
    const email = "grade-" + Date.now() + "@example.invalid";
    const password = "synthetic grade boundary password 1234";
    async function post(path: string, data: object) {
      const token = await (await page.request.get("/api/v1/auth/csrf")).json();
      return page.request.post(path, {data, headers:{"X-CSRF-TOKEN":token.token}});
    }
    expect((await post("/api/v1/auth/signup", {email,password,grade:"TEST_UPPER"})).status()).toBe(400);
    expect((await post("/api/v1/auth/signup", {email,password})).status()).toBe(201);
    const identity = await post("/api/v1/auth/login", {login:email,password});
    expect((await identity.json()).kind).toBe("USER");
    await page.addInitScript(() => localStorage.setItem("youtopia-test-grade", "TEST_UPPER"));
    await page.context().setExtraHTTPHeaders({"X-Youtopia-Test-Grade":"TEST_UPPER","X-Role":"ADMIN"});
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", {name:"접근 권한이 없습니다."})).toBeVisible();
    for (const path of ["/api/v1/admin/auth/me","/api/v1/admin/members","/api/v1/admin/usage"])
      expect((await page.request.get(path)).status()).toBe(403);
    expect((await page.request.get("/api/v1/games")).status()).toBe(200);
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

test("preparation panel is modal, mobile safe and context resets without chatbot traffic",async({page})=>{
 const requests:string[]=[];page.on("request",r=>requests.push(r.url()));
 await page.setViewportSize({width:390,height:844});await page.goto("/games/steam:570");
 await expect(page.getByRole("heading",{name:"Browser Arena",exact:true})).toBeVisible();
 const trigger=page.getByRole("button",{name:"Youtopia 분석 도우미 열기"});await trigger.click();
 const dialog=page.getByRole("dialog",{name:"Youtopia 분석 도우미"});await expect(dialog).toContainText("Browser Arena");await expect(dialog.getByRole("textbox",{name:"질문"})).toHaveCount(0);await expect(dialog.getByRole("button",{name:"CCU는 무엇인가요?"})).toBeDisabled();
 expect(await page.locator("#root").evaluate(el=>(el as HTMLElement).inert)).toBe(true);
 const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
 await page.keyboard.press("Shift+Tab");await expect(dialog.getByRole("link",{name:"관리자 로그인"})).toBeFocused();await page.keyboard.press("Tab");await expect(dialog.getByRole("button",{name:"분석 도우미 닫기"})).toBeFocused();await page.keyboard.press("Escape");await expect(trigger).toBeFocused();expect(await page.locator("#root").evaluate(el=>(el as HTMLElement).inert)).toBe(false);
 await page.goto("/games/steam:730");await trigger.click();await expect(page.getByRole("dialog")).toContainText("Browser Counter");await page.keyboard.press("Escape");
 await page.goto("/games");await trigger.click();await expect(page.getByRole("dialog")).toContainText("게임을 선택하지 않았습니다");await expect(page.getByRole("dialog")).not.toContainText("Browser Counter");
 expect(requests.filter(url=>/chatbot|\/chat\/|openai|anthropic/i.test(url))).toEqual([]);
});
test("login failure preserves public navigation and admin has no assistant",async({page})=>{
 await page.goto("/admin/login");await expect(page.getByRole("button",{name:"Youtopia 분석 도우미 열기"})).toHaveCount(0);
 await page.getByLabel("관리자 로그인명",{exact:true}).fill("nonexistent_synthetic_operator");await page.getByLabel("비밀번호",{exact:true}).fill("synthetic wrong password 1234");await page.getByRole("button",{name:"로그인",exact:true}).click();
 await expect(page.getByText("로그인 정보 또는 세션을 확인해 주세요.")).toBeVisible();
 await page.getByRole("link",{name:/로그인 없이 둘러보기/}).click();await expect(page).toHaveURL(/\/games$/);
});

test("administrator sees keyless maintenance and a mocked fixed-question answer in the public mobile panel",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/admin/login");await page.getByLabel("관리자 로그인명",{exact:true}).fill("browser_operator");await page.getByLabel("비밀번호",{exact:true}).fill("synthetic browser operator password 1234");await page.getByRole("button",{name:"로그인",exact:true}).click();await expect(page).toHaveURL(/\/admin$/);
 await page.goto("/games");const trigger=page.getByRole("button",{name:"Youtopia 분석 도우미 열기"});await trigger.click();const dialog=page.getByRole("dialog");await expect(dialog.getByText("현재 점검 중입니다. 잠시 후 다시 이용해 주세요.")).toBeVisible();await expect(dialog.getByRole("button",{name:"CCU는 무엇인가요?"})).toBeDisabled();
 let calls=0;await page.route("**/api/v1/chat/status",route=>route.fulfill({json:{available:true,state:"READY",message:"일반적인 지표 설명을 제공합니다."}}));
 await page.route("**/api/v1/chat/answers",async route=>{calls++;const body=route.request().postDataJSON();expect(Object.keys(body).sort()).toEqual(["questionId","requestId"]);expect(body.questionId).toBe("CCU_BASICS");expect(route.request().headers()["x-csrf-token"]).toBeTruthy();await route.fulfill({json:{...body,text:"<script>plain text only</script> CCU 일반 설명",replayed:false,basis:"GENERAL_METRIC_EXPLANATION_NO_GAME_DATA"}})});
 await dialog.getByRole("button",{name:"상태 다시 확인"}).click();await dialog.getByRole("button",{name:"CCU는 무엇인가요?"}).click();await expect(dialog.getByRole("status",{name:"LLM 일반 설명 응답"})).toContainText("<script>plain text only</script>");expect(calls).toBe(1);await expect(dialog.locator("script")).toHaveCount(0);await expect(dialog.getByRole("textbox")).toHaveCount(0);
 await page.keyboard.press("Escape");await expect(trigger).toBeFocused();
 const token=await(await page.request.get("/api/v1/auth/csrf")).json();expect((await page.request.post("/api/v1/auth/logout",{data:{},headers:{"X-CSRF-TOKEN":token.token}})).status()).toBe(204);
 await page.unroute("**/api/v1/chat/answers");expect((await page.request.post("/api/v1/chat/answers",{data:{questionId:"CCU_BASICS",requestId:crypto.randomUUID()},headers:{"X-CSRF-TOKEN":token.token}})).status()).not.toBe(200);
});
