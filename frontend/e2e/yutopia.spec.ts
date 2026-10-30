import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const forbiddenByPage = new WeakMap<Page, string[]>();
const forbiddenIntegration = /accounts\.google\.com|oauth2|googleapis\.com\/youtube|youtube\.com\/api|\/(?:api|graphql|backend)(?:\/|\?|$)|\bmcp\b|api\.openai\.com|api\.anthropic\.com/i;

test.beforeEach(async ({ page }) => {
  const forbiddenRequests: string[] = [];
  forbiddenByPage.set(page, forbiddenRequests);

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (forbiddenIntegration.test(url)) {
      forbiddenRequests.push(url);
      await route.abort();
      return;
    }
    await route.continue();
  });
});

test.afterEach(async ({ page }) => {
  expect(
    forbiddenByPage.get(page),
    "실제 OAuth, YouTube API, backend, MCP 또는 LLM 요청이 없어야 합니다.",
  ).toEqual([]);
});

async function loginAndOpenYoutube(page: Page) {
  await page.goto("/login");
  await page.getByLabel("이메일 주소").fill("demo@youtopia.app");
  await page.getByLabel("비밀번호", { exact: true }).fill("Youtopia123!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "로그인되었습니다." })).toBeVisible();
  await page.getByRole("link", { name: "P0-1 데모 화면 열기" }).click();
  await expect(page).toHaveURL(/\/connect\/youtube$/);
  await expect(page.getByRole("heading", { name: "YouTube 채널 연결 · 권한 요청" })).toBeVisible();
}

async function openConsentReview(page: Page) {
  await page.getByRole("button", { name: "Google 연결 · 권한 승인 →" }).click();
  await expect(page.getByRole("heading", { name: "선택한 읽기 범위를 확인해 주세요." })).toBeVisible();
}

async function approveLocally(page: Page) {
  await openConsentReview(page);
  await page.getByRole("button", { name: "시뮬레이션 승인" }).click();
  await expect(page).toHaveURL(/\/connect\/youtube\/complete$/);
}

async function createDemoProject(page: Page) {
  await page.goto("/projects/new");
  await page.getByRole("button", { name: "데이터 수집 시작 →" }).click();
  await expect(page).toHaveURL(/\/projects\/nexus-season-2\/collection$/);
  await expect(page.getByText("DEMO / QUEUED")).toBeVisible();
}

async function createSuccessfulDemoProject(page: Page) {
  await createDemoProject(page);
  await page.getByRole("button", { name: "수집 실행 시뮬레이션" }).click();
  await page.getByRole("button", { name: "완료 시뮬레이션" }).click();
  await expect(page.getByText("DEMO / SUCCEEDED")).toBeVisible();
}

async function openTrendFromSuccessfulProject(page: Page) {
  await createSuccessfulDemoProject(page);
  await page.getByRole("link", { name: "프로젝트 대시보드 보기 →" }).click();
  await page.getByRole("link", { name: "댓글 분석으로 이동 →" }).click();
  await page.getByRole("link", { name: "트렌드 관측 및 비교 →" }).click();
}

async function openEvidenceFromSuccessfulProject(page: Page) {
  await openTrendFromSuccessfulProject(page);
  await page.getByRole("link", { name: "분석 근거 검증 →" }).click();
}

async function openEvidenceDetailFromSuccessfulProject(page: Page) {
  await openEvidenceFromSuccessfulProject(page);
  await page.getByRole("link", { name: "PERF-001 근거 상세 검토 →" }).click();
}

async function openIssuesFromSuccessfulProject(page: Page) {
  await openEvidenceDetailFromSuccessfulProject(page);
  await page.getByRole("link", { name: "검토 이슈로 등록 →" }).click();
}

async function openReportWorkspaceFromSuccessfulProject(page: Page) {
  await openIssuesFromSuccessfulProject(page);
  await page.getByRole("link", { name: "AI 워크스페이스 · 보고서 초안 →" }).click();
}

async function captureThemesAndAudit(page: Page, testInfo: TestInfo, code: string) {
  for (const theme of ["dark", "light"] as const) {
    await page.getByRole("button", { name: theme === "dark" ? "다크" : "라이트" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.waitForTimeout(200);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) })),
      `${code} ${theme} 접근성 위반`,
    ).toEqual([]);
    const structure = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const clippedControls = Array.from(
        document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"),
      )
        .filter((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        })
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > viewportWidth + 1;
        })
        .map((element) => element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? element.tagName);

      return {
        clippedControls,
        h1Count: document.querySelectorAll("h1").length,
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(structure.h1Count, `${code} ${theme} 화면에는 h1이 하나여야 합니다.`).toBe(1);
    expect(structure.horizontalOverflow, `${code} ${theme} 가로 넘침`).toBeLessThanOrEqual(1);
    expect(structure.clippedControls, `${code} ${theme} 가로로 잘린 조작 요소`).toEqual([]);
    const screenshotPath = testInfo.outputPath(`${code}-${theme}.png`);
    await page.screenshot({ animations: "disabled", path: screenshotPath });
    await testInfo.attach(`${code}-${theme}`, { contentType: "image/png", path: screenshotPath });
  }
  await page.getByRole("button", { name: "다크" }).click();
}

test("기존 데모 로그인에서 YU-02로 이동하고 뒤로 갈 수 있다", async ({ page }) => {
  await loginAndOpenYoutube(page);
  await expect(page.getByText("서비스 로그인과 YouTube 권한은 서로 다릅니다.")).toBeVisible();

  await page.getByRole("button", { name: "← 이전 단계" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "환영합니다." })).toBeVisible();
});

test("라이트 테마가 새로고침 후에도 유지된다", async ({ page }) => {
  await page.goto("/connect/youtube");
  await page.getByRole("button", { name: "라이트" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "라이트" })).toHaveAttribute("aria-pressed", "true");
});

test("로컬 승인 후 YU-03을 표시하지만 새로고침은 승인 상태를 복원하지 않는다", async ({ page }) => {
  await page.goto("/connect/youtube");
  await approveLocally(page);
  await expect(page.getByRole("heading", { name: "NEXUS 공식 채널이 연결된 것으로 시뮬레이션했습니다." })).toBeVisible();

  const storageKeys = await page.evaluate(() => Object.keys(localStorage));
  expect(storageKeys.filter((key) => /token|credential|youtube-connection/i.test(key))).toEqual([]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "승인 상태를 확인할 수 없습니다." })).toBeVisible();
  await expect(page.getByRole("link", { name: "관측 프로젝트 만들기 →" })).toHaveCount(0);
});

for (const scenario of [
  { action: "거부", announcement: "권한 요청이 거부되었습니다." },
  { action: "취소", announcement: "권한 검토가 취소되었습니다." },
]) {
  test(`${scenario.action} 상태를 알리고 다시 검토한다`, async ({ page }) => {
    await page.goto("/connect/youtube");
    await openConsentReview(page);
    await page.getByRole("button", { name: scenario.action, exact: true }).click();

    await expect(page.getByRole("status")).toContainText(scenario.announcement);
    await page.getByRole("button", { name: "권한 다시 검토" }).click();
    await expect(page.getByRole("heading", { name: "선택한 읽기 범위를 확인해 주세요." })).toBeVisible();
  });
}

test("만료 상태는 완료 화면을 차단하고 재연결 경로를 제공한다", async ({ page }) => {
  await page.goto("/connect/youtube");
  await approveLocally(page);
  await page.getByRole("button", { name: "승인 만료 시뮬레이션" }).click();

  await expect(page.getByRole("alert")).toContainText("승인 완료 상태를 만들지 않습니다");
  await page.getByRole("button", { name: "다시 연결" }).click();
  await expect(page).toHaveURL(/\/connect\/youtube$/);
  await expect(page.getByRole("status")).toContainText("시뮬레이션 승인이 만료되었습니다.");
});

test("YU-03 직접 진입은 승인 완료로 취급하지 않는다", async ({ page }) => {
  await page.goto("/connect/youtube/complete");
  await expect(page.getByRole("heading", { name: "승인 상태를 확인할 수 없습니다." })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("직접 주소로 들어오거나 새로고침한 경우");
  await expect(page.getByRole("link", { name: "관측 프로젝트 만들기 →" })).toHaveCount(0);
});

test("키보드 조작, 레이블, 포커스 표시와 상태 알림을 제공한다", async ({ page }) => {
  await page.goto("/connect/youtube");

  const backButton = page.getByRole("button", { name: "← 이전 단계" });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await backButton.evaluate((element) => document.activeElement === element)) break;
  }
  await expect(backButton).toBeFocused();
  const outlineWidth = await backButton.evaluate(
    (element) => getComputedStyle(element).outlineWidth,
  );
  expect(outlineWidth).not.toBe("0px");

  const consentButton = page.getByRole("button", { name: "Google 연결 · 권한 승인 →" });
  await consentButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "선택한 읽기 범위를 확인해 주세요." })).toBeVisible();

  const denyButton = page.getByRole("button", { name: "거부", exact: true });
  await denyButton.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toContainText("권한 요청이 거부되었습니다.");
});

test("1024·1280·1440·1600px에서 셸과 콘텐츠가 가로 넘침 없이 유지된다", async ({ page }) => {
  for (const width of [1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/connect/youtube");

    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
    }));

    expect(metrics.scrollWidth, `${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);
    await expect(page.getByRole("heading", { name: "요청 권한" })).toBeVisible();
  }
});

test("YU-03 승인 화면에서 YU-04를 거쳐 YU-05 QUEUED로 이동한다", async ({ page }) => {
  await page.goto("/connect/youtube");
  await approveLocally(page);
  await page.getByRole("link", { name: "관측 프로젝트 만들기 →" }).click();

  await expect(page).toHaveURL(/\/projects\/new$/);
  await expect(page.getByRole("heading", { name: "관측 프로젝트 생성" })).toBeVisible();
  await expect(page.getByLabel("사건 날짜")).toHaveValue("2025-03-25");
  await expect(page.getByText(/사건 전 2025-03-11~2025-03-24/)).toBeVisible();
  await expect(page.getByText(/공개 데이터 관측 경로는 시뮬레이션 승인 없이/)).toBeVisible();

  await page.getByRole("button", { name: "데이터 수집 시작 →" }).click();
  await expect(page).toHaveURL(/\/projects\/nexus-season-2\/collection$/);
  await expect(page.getByText("DEMO / QUEUED")).toBeVisible();
  await expect(page.getByText("nexus-season-2")).toBeVisible();
});

test("YU-04 빈 양식과 중복 영상 선택을 거부한다", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByRole("button", { name: "양식 비우기" }).click();
  await page.getByRole("button", { name: "데이터 수집 시작 →" }).click();

  await expect(page.getByRole("alert")).toContainText("입력 내용을 확인해 주세요");
  await expect(page.getByLabel("프로젝트 이름")).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/projects\/new$/);

  await page.getByRole("button", { name: "입력 취소" }).click();
  await page.getByLabel("선택 영상 2").selectOption("update-trailer-0318");
  await page.getByRole("button", { name: "데이터 수집 시작 →" }).click();
  await expect(page.getByText("같은 영상을 중복 선택할 수 없습니다.")).toBeVisible();
  await expect(page.getByLabel("선택 영상 2")).toHaveAttribute("aria-invalid", "true");
});

test("YU-05는 모든 결정적 상태와 실패 후 재시도를 제공한다", async ({ page }) => {
  await createDemoProject(page);

  await page.getByRole("button", { name: "수집 실행 시뮬레이션" }).click();
  await expect(page.getByText("DEMO / RUNNING")).toBeVisible();
  await expect(page.getByText("4,280건")).toBeVisible();

  await page.getByRole("button", { name: "부분 결과 시뮬레이션" }).click();
  await expect(page.getByText("DEMO / PARTIAL")).toBeVisible();
  await expect(page.getByText(/8,420 = 6,510 분석 대상 \+ 1,910 제외\/보류/)).toBeVisible();
  await expect(page.getByText(/누락분은 0으로 대체하지 않고/)).toBeVisible();

  await page.getByRole("button", { name: "실패 시뮬레이션" }).click();
  await expect(page.getByText("DEMO / FAILED")).toBeVisible();
  await expect(page.locator(".collection-metrics strong", { hasText: "미확정" })).toHaveCount(3);

  await page.getByRole("button", { name: "데모 수집 다시 시도" }).click();
  await expect(page.getByText("DEMO / QUEUED")).toBeVisible();
  await expect(page.getByText("2회")).toBeVisible();

  await page.getByRole("button", { name: "수집 실행 시뮬레이션" }).click();
  await page.getByRole("button", { name: "완료 시뮬레이션" }).click();
  await expect(page.getByText("DEMO / SUCCEEDED")).toBeVisible();
  await expect(page.getByText("12,842건")).toBeVisible();
  await expect(page.getByText("10,204건")).toBeVisible();
  await expect(page.getByText("2,638건")).toBeVisible();
});

test("YU-05 직접 URL과 새로고침은 성공 상태를 만들지 않는다", async ({ page }) => {
  await page.goto("/projects/nexus-season-2/collection");
  await expect(page.getByRole("heading", { name: "진행 중인 인메모리 수집을 찾을 수 없습니다." })).toBeVisible();
  await expect(page.getByText("DEMO / SUCCEEDED")).toHaveCount(0);

  await createDemoProject(page);
  await page.getByRole("button", { name: "수집 실행 시뮬레이션" }).click();
  await page.getByRole("button", { name: "완료 시뮬레이션" }).click();
  await expect(page.getByText("DEMO / SUCCEEDED")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("alert")).toContainText("직접 주소로 들어오거나 새로고침하면");
  await expect(page.getByText("12,842건")).toHaveCount(0);
});

test("YU-04와 YU-05는 Dark/Light 토큰과 키보드 포커스를 유지한다", async ({ page }) => {
  await page.goto("/projects/new");
  const darkBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-app"));
  const projectName = page.getByLabel("프로젝트 이름");
  await projectName.focus();
  await expect(projectName).toBeFocused();
  expect(await projectName.evaluate((element) => getComputedStyle(element).outlineWidth)).not.toBe("0px");

  await page.getByRole("button", { name: "라이트" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-app"));
  expect(lightBackground).not.toBe(darkBackground);
  await expect(page.getByRole("heading", { name: "관측 프로젝트 생성" })).toBeVisible();

  await page.getByRole("button", { name: "다크" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "데이터 수집 시작 →" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("DEMO / QUEUED")).toBeVisible();
  await page.getByRole("button", { name: "라이트" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("heading", { name: "데이터 수집 기록" })).toBeVisible();
});

test("YU-04·YU-05는 1024·1280·1440·1600px에서 가로 넘침이 없다", async ({ page }) => {
  for (const width of [1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projects/new");

    let metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
    }));
    expect(metrics.scrollWidth, `YU-04 ${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);

    await page.getByRole("button", { name: "데이터 수집 시작 →" }).click();
    metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
    }));
    expect(metrics.scrollWidth, `YU-05 ${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);
    await expect(page.getByRole("heading", { name: "데이터 수집 기록" })).toBeVisible();
  }
});

test("YU-05 성공에서 YU-06을 거쳐 YU-07로 이동하고 출처·분모를 보존한다", async ({ page }) => {
  await createSuccessfulDemoProject(page);
  await page.getByRole("link", { name: "프로젝트 대시보드 보기 →" }).click();

  await expect(page).toHaveURL(/\/projects\/nexus-season-2\/overview$/);
  await expect(page.getByRole("heading", { name: "프로젝트 대시보드" })).toBeVisible();
  await expect(page.getByText("12,842건", { exact: true })).toBeVisible();
  await expect(page.getByText("10,204건", { exact: true })).toBeVisible();
  await expect(page.getByText("28건", { exact: true })).toBeVisible();
  await expect(page.getByLabel("데모 데이터 출처와 범위")).toContainText("2025-03-01~2025-04-08");
  await expect(page.getByLabel("데모 데이터 출처와 범위")).toContainText("2025-03-11~2025-03-24");

  await page.getByRole("link", { name: "댓글 분석으로 이동 →" }).click();
  await expect(page).toHaveURL(/\/projects\/nexus-season-2\/comments$/);
  await expect(page.getByRole("heading", { name: "댓글 감성 · 이슈 분석" })).toBeVisible();
  await expect(page.getByLabel("분류 분모 정합성")).toContainText("8,421건");
  await expect(page.getByLabel("분류 분모 정합성")).toContainText("1,783건");
  await expect(page.getByText("4,884건")).toBeVisible();
});

test("YU-06은 partial·failed·unavailable을 성공으로 표시하지 않는다", async ({ page }) => {
  await createDemoProject(page);
  await page.getByRole("button", { name: "수집 실행 시뮬레이션" }).click();
  await page.getByRole("button", { name: "부분 결과 시뮬레이션" }).click();
  await page.getByRole("link", { name: "현재 상태로 대시보드 미리보기" }).click();
  await expect(page.getByRole("heading", { name: "부분 수집 결과만 사용할 수 있습니다." })).toBeVisible();
  await expect(page.getByText("28건")).toHaveCount(0);

  await page.getByRole("link", { name: "수집 상태 확인하기" }).click();
  await page.getByRole("button", { name: "누락 설명 확인 후 계속" }).click();
  await page.getByRole("button", { name: "실패 시뮬레이션" }).click();
  await page.getByRole("link", { name: "현재 상태로 대시보드 미리보기" }).click();
  await expect(page.getByRole("heading", { name: "수집 실패로 대시보드를 만들 수 없습니다." })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "활성 프로젝트 데이터를 찾을 수 없습니다." })).toBeVisible();
  await expect(page.getByText("12,842건")).toHaveCount(0);
});

test("YU-07 이슈 필터·감성 탭·대표 댓글·HOLD·근거 링크가 동작한다", async ({ page }) => {
  await createSuccessfulDemoProject(page);
  await page.getByRole("link", { name: "프로젝트 대시보드 보기 →" }).click();
  await page.getByRole("link", { name: /PAY-002/ }).click();

  await expect(page).toHaveURL(/comments\?issue=PAY-002$/);
  await expect(page.getByRole("heading", { name: "PAY-002 · 과금/가격" })).toBeVisible();
  await expect(page.locator(".issue-detail-panel .issue-state", { hasText: "HOLD" })).toBeVisible();
  await expect(page.getByText(/급증을 주장하지 않습니다/)).toBeVisible();
  await expect(page.getByText("SYN-PAY-01", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "근거 화면으로 이동" })).toHaveAttribute(
    "href",
    "/projects/nexus-season-2/evidence?issue=PAY-002",
  );

  await page.getByRole("tab", { name: "긍정" }).click();
  await expect(page.getByRole("status")).toContainText("해당하는 합성 대표 댓글이 없습니다");
  await page.getByRole("tab", { name: "부정" }).click();
  await expect(page.getByText("SYN-PAY-01", { exact: true })).toBeVisible();

  await page.getByLabel("이슈 필터").selectOption("PERF-001");
  await expect(page).toHaveURL(/comments\?issue=PERF-001$/);
  await expect(page.getByText(/실제 게임 결함을 확정하지 않습니다/)).toBeVisible();
});

test("YU-07 뒤로 가기는 상태를 유지하고 새로고침은 분석 성공을 복원하지 않는다", async ({ page }) => {
  await createSuccessfulDemoProject(page);
  await page.getByRole("link", { name: "프로젝트 대시보드 보기 →" }).click();
  await page.getByRole("link", { name: /PERF-001/ }).click();
  await expect(page.getByRole("heading", { name: "PERF-001 · 성능 저하" })).toBeVisible();

  await page.getByRole("button", { name: "← 이전 단계" }).click();
  await expect(page.getByRole("heading", { name: "프로젝트 대시보드" })).toBeVisible();
  await expect(page.getByText("12,842건", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "댓글 분석으로 이동 →" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "완료된 인메모리 수집이 필요합니다." })).toBeVisible();
  await expect(page.getByText("4,884건")).toHaveCount(0);
});

test("YU-06·YU-07은 두 테마와 1024·1280·1440·1600px에서 가로 넘침이 없다", async ({ page }) => {
  for (const width of [1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await createSuccessfulDemoProject(page);
    await page.getByRole("link", { name: "프로젝트 대시보드 보기 →" }).click();

    await page.getByRole("button", { name: "다크" }).click();
    const darkBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-app"));
    await page.getByRole("button", { name: "라이트" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const lightBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-app"));
    expect(lightBackground).not.toBe(darkBackground);

    let metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
    }));
    expect(metrics.scrollWidth, `YU-06 ${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);

    await page.getByRole("link", { name: "댓글 분석으로 이동 →" }).click();
    metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
    }));
    expect(metrics.scrollWidth, `YU-07 ${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);
    await expect(page.getByRole("heading", { name: "분류별 건수 · 10,204건" })).toBeVisible();
    await page.getByRole("button", { name: "다크" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
  }
});

test("YU-07에서 YU-08을 거쳐 YU-09로 이동하며 날짜·분모·출처를 유지한다", async ({ page }) => {
  await createSuccessfulDemoProject(page);
  await page.getByRole("link", { name: "프로젝트 대시보드 보기 →" }).click();
  await page.getByRole("link", { name: "댓글 분석으로 이동 →" }).click();
  await page.getByRole("link", { name: "트렌드 관측 및 비교 →" }).click();

  await expect(page).toHaveURL(/\/projects\/nexus-season-2\/trends$/);
  await expect(page.getByRole("heading", { name: "트렌드 관측 · 패치 전후 비교" })).toBeVisible();
  await expect(page.getByText("3,543건", { exact: true })).toBeVisible();
  await expect(page.getByText("7,244건", { exact: true })).toBeVisible();
  await expect(page.getByText(/전체 관측 창 39일 중 비교 창 28일, 비교 창 밖 11일/)).toBeVisible();
  await expect(page.getByRole("status")).toContainText("CONDITIONAL");
  await expect(page.getByRole("alert")).toContainText("검증된 증가 주장 차단");
  await expect(page.getByLabel("데모 데이터 출처와 범위")).toContainText("update-trailer-0318");

  await page.getByRole("link", { name: "분석 근거 검증 →" }).click();
  await expect(page).toHaveURL(/\/projects\/nexus-season-2\/evidence$/);
  await expect(page.getByRole("heading", { name: "선택한 주장 / PERF-001" })).toBeVisible();
  await expect(page.getByText("REAL-WORLD VERIFIED: NO")).toBeVisible();
});

test("YU-09 PAY-002 딥 링크는 증가 승인을 차단하고 HOLD를 유지한다", async ({ page }) => {
  await openEvidenceFromSuccessfulProject(page);
  await page.getByRole("button", { name: /PAY-002/ }).click();
  await expect(page).toHaveURL(/evidence\?issue=PAY-002$/);

  const panel = page.locator(".selected-claim-panel");
  await expect(panel.getByText("HOLD", { exact: true })).toBeVisible();
  await expect(panel.getByText(/영상 게시일과 모집단이 달라/)).toBeVisible();
  await panel.getByRole("button", { name: "실제 주장 승인 시도" }).click();
  await expect(panel.getByRole("status")).toContainText("증가 주장은 HOLD");
  await expect(panel.getByText("HOLD", { exact: true })).toBeVisible();
  await expect(panel.getByText("POLICY_BLOCKED", { exact: true })).toBeVisible();
});

test("YU-09 PERF-001은 관측만 유지하며 실제 게임 결함이 되지 않는다", async ({ page }) => {
  await openEvidenceFromSuccessfulProject(page);

  const panel = page.locator(".selected-claim-panel");
  await expect(panel.getByText("OBSERVED_ONLY", { exact: true })).toBeVisible();
  await expect(panel.getByText(/실제 게임 결함은 미검증/)).toBeVisible();
  await panel.getByRole("button", { name: "실제 주장 승인 시도" }).click();
  await expect(panel.getByRole("status")).toContainText("실제 게임 결함은 미검증");
  await expect(panel.getByText("BLOCKED", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "PERF-001 근거 상세 검토 →" })).toHaveAttribute(
    "href",
    "/projects/nexus-season-2/evidence/PERF-001",
  );
});

test("YU-08·YU-09 직접 진입과 새로고침은 완료 상태를 만들지 않는다", async ({ page }) => {
  await page.goto("/projects/nexus-season-2/trends");
  await expect(page.getByRole("heading", { name: "완료된 인메모리 수집이 필요합니다." })).toBeVisible();
  await expect(page.getByText("3,543건")).toHaveCount(0);

  await openTrendFromSuccessfulProject(page);
  await expect(page.getByText("3,543건", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "완료된 인메모리 수집이 필요합니다." })).toBeVisible();

  await page.goto("/projects/nexus-season-2/evidence?issue=PAY-002");
  await expect(page.getByRole("heading", { name: "검증할 완료 수집을 찾을 수 없습니다." })).toBeVisible();
  await expect(page.getByText("REAL-WORLD VERIFIED: NO")).toHaveCount(0);
});

test("YU-08·YU-09는 두 테마·키보드와 1024·1280·1440·1600px 레이아웃을 유지한다", async ({ page }) => {
  for (const width of [1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await openTrendFromSuccessfulProject(page);

    await page.getByRole("button", { name: "라이트" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    let metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
    }));
    expect(metrics.scrollWidth, `YU-08 ${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);

    await page.getByRole("link", { name: "분석 근거 검증 →" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "근거 및 데이터 품질 검증" })).toBeVisible();
    metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
    }));
    expect(metrics.scrollWidth, `YU-09 ${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);

    await page.getByRole("button", { name: "다크" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: /PAY-002/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "선택한 주장 / PAY-002" })).toBeVisible();
  }
});

test("YU-09에서 YU-10을 거쳐 YU-11로 이동하며 PERF-001 계보를 유지한다", async ({ page }) => {
  await openEvidenceDetailFromSuccessfulProject(page);
  await expect(page).toHaveURL(/\/projects\/nexus-season-2\/evidence\/PERF-001$/);
  await expect(page.getByRole("heading", { name: "PERF-001 · 근거 상세 검토" })).toBeVisible();
  await expect(page.getByText("SYNTHETIC COMMENT")).toHaveCount(2);
  await expect(page.getByText(/developer-live-0325\/SYN-PERF-01/)).toBeVisible();
  await expect(page.getByText(/실제 게임 결함으로 승인할 수 없습니다/)).toBeVisible();

  await page.getByRole("link", { name: "검토 이슈로 등록 →" }).click();
  await expect(page).toHaveURL(/\/projects\/nexus-season-2\/issues\?issue=PERF-001$/);
  await expect(page.getByRole("heading", { name: "이슈 관리 · 담당자 검토" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PERF-001 · 성능 저하" })).toBeVisible();
  await expect(page.getByText(/EVD-SYN-PERF-01/)).toBeVisible();
});

test("YU-10은 available·missing·deleted·expired·stale·access-denied 상태를 결정적으로 표시한다", async ({ page }) => {
  await openEvidenceDetailFromSuccessfulProject(page);
  const selector = page.getByLabel("근거 가용성 시뮬레이션");

  await expect(page.getByRole("status")).toContainText("자료 사용 가능");
  for (const [value, message] of [
    ["MISSING", "근거 누락"],
    ["DELETED", "삭제됨"],
    ["EXPIRED", "접근 기간 만료"],
    ["STALE", "오래된 근거"],
    ["ACCESS_DENIED", "접근 거부"],
  ] as const) {
    await selector.selectOption(value);
    await expect(page.getByRole("status")).toContainText(message);
    await expect(page.getByText(/실제 게임 결함으로 승인할 수 없습니다/)).toBeVisible();
  }
  await selector.selectOption("MISSING");
  await expect(page.getByText(/원문 내용은 표시하지 않습니다/)).toBeVisible();
  await expect(page.getByText("SYNTHETIC COMMENT")).toHaveCount(0);
});

test("YU-10은 빈·잘못된 claim ID와 새로고침 후 프로젝트 손실을 안전하게 처리한다", async ({ page }) => {
  await page.goto("/projects/nexus-season-2/evidence-detail");
  await expect(page.getByRole("heading", { name: "검토할 주장 ID가 필요합니다." })).toBeVisible();
  await page.goto("/projects/nexus-season-2/evidence/UNKNOWN-999");
  await expect(page.getByRole("heading", { name: "지원하지 않는 주장 ID입니다." })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("UNKNOWN-999");

  await openEvidenceDetailFromSuccessfulProject(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "근거 상세에 필요한 완료 수집이 없습니다." })).toBeVisible();
  await expect(page.getByText("SYNTHETIC COMMENT")).toHaveCount(0);
});

test("YU-11은 담당자·반려·감사 전이를 기록하고 PAY-002 완료 승격을 차단한다", async ({ page }) => {
  await openIssuesFromSuccessfulProject(page);
  await page.getByRole("button", { name: /PAY-002/ }).click();
  const panel = page.locator(".issue-review-panel");
  await panel.getByRole("button", { name: "검토 완료 시도" }).click();
  await expect(panel.getByRole("status")).toContainText("PAY-002 HOLD 주장은 검토 완료");
  await expect(panel.getByText("WAITING", { exact: true })).toBeVisible();

  await panel.getByLabel("담당자 · SIMULATED").selectOption("DEMO_REVIEWER_A");
  await expect(panel.getByRole("status")).toContainText("DEMO_REVIEWER_A");
  await panel.getByRole("button", { name: "검토 반려" }).click();
  await expect(panel.getByText("REJECTED", { exact: true })).toBeVisible();
  await expect(panel.getByText("REVIEW_REJECTED", { exact: true })).toBeVisible();
  expect(await panel.getByText("DEMO_REVIEWER_UNAUTHENTICATED", { exact: true }).count()).toBeGreaterThan(0);
});

test("YU-11은 empty·unavailable·permission-denied와 뒤로가기를 지원한다", async ({ page }) => {
  await openIssuesFromSuccessfulProject(page);
  const boardState = page.getByLabel("보드 상태");
  await boardState.selectOption("EMPTY");
  await expect(page.getByRole("heading", { name: "표시할 이슈가 없습니다." })).toBeVisible();
  await boardState.selectOption("UNAVAILABLE");
  await expect(page.getByRole("heading", { name: "이슈 보드를 사용할 수 없습니다." })).toBeVisible();
  await boardState.selectOption("PERMISSION_DENIED");
  await expect(page.getByRole("heading", { name: "이슈 보드 접근 권한이 없습니다." })).toBeVisible();
  await boardState.selectOption("ACTIVE");

  await page.getByRole("button", { name: "← 이전 단계" }).click();
  await expect(page.getByRole("heading", { name: "PERF-001 · 근거 상세 검토" })).toBeVisible();
  await page.getByRole("button", { name: "← 이전 단계" }).click();
  await expect(page.getByRole("heading", { name: "근거 및 데이터 품질 검증" })).toBeVisible();

  await page.goto("/projects/nexus-season-2/issues");
  await expect(page.getByRole("heading", { name: "이슈 보드에 필요한 완료 수집이 없습니다." })).toBeVisible();
});

test("YU-10·YU-11은 두 테마·키보드와 1024·1280·1440·1600px 레이아웃을 유지한다", async ({ page }) => {
  for (const width of [1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await openEvidenceDetailFromSuccessfulProject(page);

    await page.getByRole("button", { name: "라이트" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByLabel("근거 가용성 시뮬레이션").focus();
    await page.getByLabel("근거 가용성 시뮬레이션").selectOption("STALE");
    let metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
    }));
    expect(metrics.scrollWidth, `YU-10 ${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);

    await page.getByRole("link", { name: "검토 이슈로 등록 →" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "이슈 관리 · 담당자 검토" })).toBeVisible();
    metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
    }));
    expect(metrics.scrollWidth, `YU-11 ${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);

    await page.getByRole("button", { name: "다크" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: /PAY-002/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "PAY-002 · 과금\/가격" })).toBeVisible();
  }
});

test("YU-11에서 YU-12로 이동해 마스킹 프롬프트와 보고서 초안을 생성한다", async ({ page }) => {
  await openReportWorkspaceFromSuccessfulProject(page);
  await expect(page).toHaveURL(/\/projects\/nexus-season-2\/ai-report$/);
  await expect(page.getByRole("heading", { name: "연결 가능한 AI 도구" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "검증된 근거를 활용하는 AI" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "보고서 · 공유" })).toBeVisible();
  await expect(page.getByText(/update-trailer-0318, patch-notes-0324, developer-live-0325/)).toBeVisible();
  await expect(page.getByText(/PERF-001: 합성 댓글에서 프레임 저하 호소 표현 관측/)).toBeVisible();
  await expect(page.getByText(/PAY-002: 증가 주장을 뒷받침할 비교 근거가 없어 HOLD/)).toBeVisible();

  await page.getByRole("button", { name: "로컬 초안 시뮬레이션" }).click();
  await expect(page.getByRole("status")).toContainText("외부 요청은 없습니다");
  await page.getByRole("button", { name: "초안 생성 완료" }).click();
  await expect(page.getByRole("status")).toContainText("사람 검토 대기");
  const draft = page.getByRole("article", { name: "시뮬레이션 보고서 초안" });
  await expect(draft).toContainText("12,842건 = 분석 대상 10,204건 + 제외/보류 2,638건");
  await expect(draft).toContainText("실제 게임 결함과 패치 인과관계는 미검증");
  await expect(draft).toContainText("증가 주장을 검증할 수 없습니다");
  await page.getByRole("button", { name: "검토 대기 초안 미리보기" }).click();
  await expect(page.getByRole("status")).toContainText("정식 승인·저장·공유 상태가 아닙니다");
});

test("YU-12는 합성 원문·HOLD·외부 도구·권한 정책을 격리한다", async ({ page }) => {
  await openReportWorkspaceFromSuccessfulProject(page);
  await expect(page.getByText("업데이트 뒤 특정 전투 장면에서 프레임이 끊기는 느낌이 있어요.")).toHaveCount(0);
  await expect(page.getByText(/허용 관측 후보.*PERF-001/)).toBeVisible();
  await expect(page.getByText(/확정 결론 차단.*PAY-002.*HOLD 유지/)).toBeVisible();

  await page.getByRole("button", { name: /ChatGPT/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("사용할 수 없습니다");
  await page.getByRole("button", { name: "내부 로컬 데모로 돌아가기" }).click();
  await page.getByRole("button", { name: /MCP 인터페이스/ }).click();
  await expect(page.getByRole("status")).toContainText("정책 때문에");
  await page.getByRole("button", { name: "내부 로컬 데모로 돌아가기" }).click();
  await page.getByLabel("근거 번들 권한 · SIMULATED").selectOption("DENIED");
  await expect(page.getByRole("status")).toContainText("권한 또는 외부 전달 정책");
  await expect(page.getByText(/\[POLICY_BLOCKED\]/)).toBeVisible();
  await expect(page.getByRole("article", { name: "시뮬레이션 보고서 초안" })).toHaveCount(0);
});

test("YU-12 실패·재시도와 공유 차단 상태가 결정적으로 동작한다", async ({ page }) => {
  await openReportWorkspaceFromSuccessfulProject(page);
  await page.getByRole("button", { name: "로컬 초안 시뮬레이션" }).click();
  await page.getByRole("button", { name: "실패 시뮬레이션" }).click();
  await expect(page.getByRole("status")).toContainText("로컬 생성 실패");
  await page.getByRole("button", { name: "재시도 준비" }).click();
  await expect(page.getByRole("status")).toContainText("재시도 준비 상태");
  await page.getByRole("button", { name: "동일 fixture로 다시 실행" }).click();
  await expect(page.getByRole("status")).toContainText("외부 요청은 없습니다");

  for (const name of ["내보내기", "링크 공유", "다운로드"]) {
    await expect(page.getByRole("button", { name })).toBeDisabled();
  }
  await expect(page.getByText(/정책과 서버 계약이 없어 차단/)).toBeVisible();
});

test("YU-12 직접 진입·새로고침·브라우저 기록은 인메모리 경계를 지킨다", async ({ page }) => {
  await page.goto("/projects/nexus-season-2/ai-report");
  await expect(page.getByRole("heading", { name: "AI 보고서에 필요한 완료 수집이 없습니다." })).toBeVisible();
  await expect(page.getByRole("article", { name: "시뮬레이션 보고서 초안" })).toHaveCount(0);

  await openReportWorkspaceFromSuccessfulProject(page);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "이슈 관리 · 담당자 검토" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "AI 워크스페이스 · 보고서 공유" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "AI 보고서에 필요한 완료 수집이 없습니다." })).toBeVisible();
});

test("YU-12는 두 테마·키보드와 1024·1280·1440·1600px 3열 레이아웃을 유지한다", async ({ page }) => {
  for (const width of [1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await openReportWorkspaceFromSuccessfulProject(page);

    await page.getByRole("button", { name: "라이트" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: /내부 AI/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /내부 AI/ })).toHaveAttribute("aria-pressed", "true");

    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: Math.round(document.querySelector(".app-sidebar")?.getBoundingClientRect().width ?? 0),
      columns: document.querySelectorAll(".ai-workspace-grid > section").length,
      gridDisplay: getComputedStyle(document.querySelector(".ai-workspace-grid")!).display,
    }));
    expect(metrics.scrollWidth, `YU-12 ${width}px에서 가로 오버플로가 없어야 합니다.`).toBe(metrics.clientWidth);
    expect(metrics.sidebarWidth).toBe(width < 1280 ? 64 : 208);
    expect(metrics.columns).toBe(3);
    expect(metrics.gridDisplay).toBe("grid");

    await page.getByRole("button", { name: "다크" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  }
});

test("공개 데이터 관측 경로는 선택적 채널 권한 없이 프로젝트 생성으로 이동한다", async ({ page }) => {
  await loginAndOpenYoutube(page);
  await expect(page.getByText("연결 안 됨", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "프로젝트" }).click();
  await expect(page).toHaveURL(/\/projects\/new$/);
  await expect(page.getByRole("heading", { name: "관측 프로젝트 생성" })).toBeVisible();
  await expect(page.getByText(/공개 데이터 관측 경로는 시뮬레이션 승인 없이 진행/)).toBeVisible();
});

test("YU-11 공유 상태는 YU-12에 전달되지만 주장 검증과 보고서 승인으로 승격되지 않는다", async ({ page }) => {
  await openIssuesFromSuccessfulProject(page);
  const panel = page.locator(".issue-review-panel");
  await panel.getByRole("button", { name: "검토 완료 시도" }).click();
  await expect(panel.getByText("COMPLETED", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "AI 워크스페이스 · 보고서 초안 →" }).click();
  await page.getByRole("button", { name: "로컬 초안 시뮬레이션" }).click();
  await page.getByRole("button", { name: "초안 생성 완료" }).click();
  const draft = page.getByRole("article", { name: "시뮬레이션 보고서 초안" });
  await expect(draft).toContainText("Kanban 완료 항목(PERF-001)도 검증된 주장으로 자동 전환하지 않습니다.");
  await expect(draft).toContainText("실제 게임 결함과 패치 인과관계는 미검증");
  await expect(draft).toContainText("실제 AI가 생성하지 않았습니다");

  await page.reload();
  await expect(page.getByRole("heading", { name: "AI 보고서에 필요한 완료 수집이 없습니다." })).toBeVisible();
  await expect(page.getByRole("article", { name: "시뮬레이션 보고서 초안" })).toHaveCount(0);
});

test("대화상자와 AppShell 건너뛰기 링크는 키보드 포커스를 안전하게 관리한다", async ({ page }) => {
  await page.goto("/login");
  const signupTrigger = page.getByRole("button", { name: "회원가입하기" });
  await signupTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "데모 계정 만들기" }).getByLabel("이메일")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(signupTrigger).toBeFocused();

  await page.goto("/connect/youtube");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "본문으로 건너뛰기" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("YU-01~YU-12 Dark/Light 접근성 및 1600px 시각 QA 캡처", async ({ page }, testInfo) => {
  // This single case runs 24 full axe audits plus screenshots across 12 screens.
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/login");
  await captureThemesAndAudit(page, testInfo, "YU-01");

  await loginAndOpenYoutube(page);
  await captureThemesAndAudit(page, testInfo, "YU-02");
  await approveLocally(page);
  await captureThemesAndAudit(page, testInfo, "YU-03");

  await page.getByRole("link", { name: "관측 프로젝트 만들기 →" }).click();
  await captureThemesAndAudit(page, testInfo, "YU-04");
  await page.getByRole("button", { name: "데이터 수집 시작 →" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY), { message: "경로 전환 후 상단 스크롤 복원" }).toBe(0);
  await captureThemesAndAudit(page, testInfo, "YU-05");
  await page.getByRole("button", { name: "수집 실행 시뮬레이션" }).click();
  await page.getByRole("button", { name: "완료 시뮬레이션" }).click();

  await page.getByRole("link", { name: "프로젝트 대시보드 보기 →" }).click();
  await captureThemesAndAudit(page, testInfo, "YU-06");
  await page.getByRole("link", { name: "댓글 분석으로 이동 →" }).click();
  await captureThemesAndAudit(page, testInfo, "YU-07");
  await page.getByRole("link", { name: "트렌드 관측 및 비교 →" }).click();
  await captureThemesAndAudit(page, testInfo, "YU-08");
  await page.getByRole("link", { name: "분석 근거 검증 →" }).click();
  await captureThemesAndAudit(page, testInfo, "YU-09");
  await page.getByRole("link", { name: "PERF-001 근거 상세 검토 →" }).click();
  await captureThemesAndAudit(page, testInfo, "YU-10");
  await page.getByRole("link", { name: "검토 이슈로 등록 →" }).click();
  await captureThemesAndAudit(page, testInfo, "YU-11");
  await page.getByRole("link", { name: "AI 워크스페이스 · 보고서 초안 →" }).click();
  await captureThemesAndAudit(page, testInfo, "YU-12");
});
