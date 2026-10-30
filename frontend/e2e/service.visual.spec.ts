import { expect, test } from "@playwright/test";
test.skip(
  process.env.YOUTOPIA_REAL_E2E !== "true",
  "Requires real isolated service and fake test users",
);
test("same-resolution game views preserve demo tokens and fit the viewport", async ({
  page,
}, testInfo) => {
  const email =
      "visual-" + testInfo.project.name + "-" + Date.now() + "@example.invalid",
    password = "synthetic visual member password 1234";
  await page.goto("/login");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath("login.png"),
    fullPage: true,
  });
  const csrf = await (await page.request.get("/api/v1/auth/csrf")).json();
  const created = await page.request.post("/api/v1/auth/signup", {
    data: { email, password },
    headers: { "X-CSRF-TOKEN": csrf.token },
  });
  expect(created.status()).toBe(201);
  await page.getByLabel("이메일 주소", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "게임 활동 현황", exact: true }),
  ).toBeVisible();
  const theme = testInfo.project.name.endsWith("dark") ? "dark" : "light";
  await page
    .getByRole("button", {
      name: theme === "dark" ? "다크" : "라이트",
      exact: true,
    })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  for (const [name, path, title] of [
    ["games", "/games", "관측 게임 탐색"],
    ["detail", "/games/steam:570", "Browser Arena"],
    ["charts", "/charts/steam", "Steam 트렌드 차트"],
    ["settings", "/settings", "내 계정 · 설정"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("관측 데이터를 불러오고 있습니다."),
    ).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(name + ".png"),
      fullPage: true,
    });
    const style = await page.evaluate(() => ({
      background: getComputedStyle(document.documentElement)
        .getPropertyValue("--bg-surface")
        .trim(),
      text: getComputedStyle(document.documentElement)
        .getPropertyValue("--text-primary")
        .trim(),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    expect(style.background).toBe(theme === "dark" ? "#0f1115" : "#ffffff");
    expect(style.text).toBe(theme === "dark" ? "#f3f6fb" : "#18233b");
    expect(style.overflow).toBe(false);
    if (name === "games" && testInfo.project.name.includes("mobile")) {
      const region = page.getByRole("region", {
        name: "관측 게임 목록 가로 스크롤",
      });
      expect(
        await region.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByText("표를 좌우로 움직여 모든 관측 지표를 확인하세요."),
      ).toBeVisible();
      await region.focus();
      await expect(region).toBeFocused();
    }
  }
});
