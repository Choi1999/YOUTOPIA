import { expect, test } from "@playwright/test";
test.skip(process.env.YOUTOPIA_REAL_E2E !== "true", "Requires owned isolated packaged JAR");
  test("collection filter restores URL/back/detail state with whole-result sorting on mobile",async({page})=>{
    await page.setViewportSize({width:390,height:844});await page.goto("/games?page=2&size=1&days=7");
    const filter=page.getByRole("combobox",{name:"수집 분류",exact:true});await expect(filter).toBeEnabled();
    await filter.selectOption("weekly_browser|sales");await expect(page).toHaveURL(/page=0/);
    await filter.selectOption("weekly_uncategorized|");await page.goBack();await expect(filter).toHaveValue("weekly_browser|sales");
    await page.reload();await expect(filter).toHaveValue("weekly_browser|sales");
    await page.getByRole("combobox",{name:"정렬",exact:true}).selectOption("currentCcu");await expect(page.getByRole("combobox",{name:"방향",exact:true})).toHaveValue("DESC");
    await page.getByRole("button",{name:"다음",exact:true}).click();await expect(page).toHaveURL(/page=1/);
    await page.getByRole("link",{name:"Browser Counter",exact:true}).click();await expect(page.getByRole("heading",{name:"Browser Counter",exact:true})).toBeVisible();
    await page.getByRole("link",{name:"← 게임 목록",exact:true}).click();await expect(page).toHaveURL(/page=1/);await expect(filter).toHaveValue("weekly_browser|sales");
    expect(new URL(page.url()).searchParams.get("sort")).toBe("currentCcu");
    expect(await page.locator("body").evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
  });
test("Steam tag composes with collection and restores reload, back and detail return on mobile",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/games?page=2&size=1&days=7&classification=weekly_browser%7Csales");
 const tag=page.getByRole("combobox",{name:"Steam 태그",exact:true});await expect(tag).toBeEnabled();await tag.selectOption("701");await expect(page).toHaveURL(/page=0/);
 await tag.selectOption("122");await page.goBack();await expect(tag).toHaveValue("701");await page.reload();await expect(tag).toHaveValue("701");
 await expect(page.getByRole("combobox",{name:"수집 분류",exact:true})).toHaveValue("weekly_browser|sales");
 await page.getByRole("combobox",{name:"정렬",exact:true}).selectOption("currentCcu");await page.getByRole("button",{name:"다음",exact:true}).click();await expect(page).toHaveURL(/page=1/);
 await page.getByRole("link",{name:"Browser Counter",exact:true}).click();await expect(page.getByRole("heading",{name:"Browser Counter",exact:true})).toBeVisible();await page.getByRole("link",{name:"← 게임 목록",exact:true}).click();await expect(tag).toHaveValue("701");await expect(page).toHaveURL(/page=1/);
 await page.getByRole("searchbox",{name:"게임명 검색"}).fill("Browser");await page.getByRole("button",{name:"검색",exact:true}).click();await expect(page).toHaveURL(/page=0/);await expect(tag).toHaveValue("701");
 await tag.selectOption("ALL");await expect(page).toHaveURL(/tagId=ALL/);expect(new URL(page.url()).searchParams.get("classification")).toBe("weekly_browser|sales");
 expect(await page.locator("body").evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
});
