import { expect, test } from "@playwright/test";

test("reads the synthetic publication and its stored statistics through Spring", async ({ page }) => {
  test.skip(process.env.YOUTOPIA_REAL_E2E !== "true", "Requires the isolated packaged service");
  await page.goto("/games/steam:570/youtube?days=7");
  const publication = page.waitForResponse(response => {
    const url = new URL(response.url());
    return decodeURIComponent(url.pathname) === "/api/v1/games/steam:570/youtube-publications" && url.searchParams.get("scope") === "period";
  });
  await page.getByLabel("게시 영상 범위").selectOption("period");
  const response = await publication;
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    videoScope: "period", summary: { observedVideos: 1, periodVideos: 1 },
    videos: { content: [{ videoId: "abcdefghijk", title: "Browser Arena saved video" }] },
  });
  await expect(page.getByRole("link", { name: "Browser Arena saved video" })).toBeVisible();
  const stats = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/youtube/videos/abcdefghijk/observations");
  await page.getByRole("link", { name: "저장된 영상 통계 보기" }).click();
  const observations = await stats;
  expect(observations.status()).toBe(200);
  expect((await observations.json()).comparison.cumulativeDifference).toBe(200);
  await expect(page.getByText(/최초 1,000 → 마지막 1,200/)).toBeVisible();
  await page.getByRole("link", { name: "← 게시 영상 목록" }).click();
  await expect(page.getByLabel("게시 영상 범위")).toHaveValue("period");
  await expect(page.getByRole("link", { name: "Browser Arena saved video" })).toBeVisible();
});
