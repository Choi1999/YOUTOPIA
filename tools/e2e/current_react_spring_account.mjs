// Executes via node --input-type=module --eval from the selected frontend
// checkout so @playwright/test resolves from its installed dependencies.
// This is an actual Chromium browser hitting the packaged Spring JAR behind the
// Vite same-origin proxy; neither the browser nor its process calls YouTube.
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const host = "127.0.0.1";
const port = process.env.YOUTOPIA_TEST_WEB_PORT;
const email = process.env.YOUTOPIA_E2E_MEMBER_EMAIL;
const password = process.env.YOUTOPIA_E2E_MEMBER_PASSWORD;
assert.match(port ?? "", /^[0-9]{4,5}$/);
assert.equal(email, "packaged@example.invalid");
assert.equal(password, "fake packaged test password 1234");
assert.equal(process.env.VITE_R04AO_LOCAL_AUTH_PROXY, "enabled");

const base = "http://" + host + ":" + port;
const paths = [];
const apiPaths = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  // All requests must remain on the isolated local Vite host.
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== host || url.protocol !== "http:") {
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/")) apiPaths.push(url.pathname);
    if (url.pathname.startsWith("/api/v1/auth/")) paths.push(url.pathname);
  });

  await page.goto(base + "/account/server", { waitUntil: "networkidle" });
  const status = page.locator(".server-session-status");
  await expect(status).toHaveText("아직 서버 확인을 요청하지 않았습니다.");
  assert.equal(paths.length, 0, "No eager Spring session requests before user intent");

  // Real backend 401 must be displayed as guest, not demo auth.
  await page.getByRole("button", { name: "서버 세션 확인" }).click();
  await expect(status).toHaveText("서버 회원 로그인 안 됨");
  assert.deepEqual(paths, ["/api/v1/auth/me"]);

  // Fetch actual Spring CSRF, POST a synthetic username/password, then GET /me
  // through the same-origin proxy. React must not trust POST 200 by itself.
  await page.getByLabel("서버 계정 이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "Spring 회원 로그인" }).click();
  await expect(status).toHaveText("서버에서 인증된 USER 회원", { timeout: 20000 });
  assert.deepEqual(paths.slice(-3), [
    "/api/v1/auth/csrf", "/api/v1/auth/login", "/api/v1/auth/me",
  ]);
  await expect(page.getByText("Spring 서버가 로그인 후 USER 세션을 다시 확인했습니다.")).toBeVisible();
  await expect(page.getByLabel("비밀번호")).toHaveValue("");
  await expect(page.locator(".server-session-identity code"))
    .toHaveText(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);

  const cookies = await context.cookies(base);
  const cookie = cookies.find(item => item.name === "YOUTOPIA_SESSION");
  assert.ok(cookie, "Packaged Spring must set the real session cookie");
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, "Lax");

  const sensitiveStored = await page.evaluate(secret =>
    [window.localStorage, window.sessionStorage].some(store =>
      Array.from({ length: store.length }, (_, index) => {
        const key = store.key(index);
        const value = key ? store.getItem(key) : "";
        return Boolean(key?.includes(secret) || value?.includes(secret));
      }).some(Boolean)
    ), password);
  assert.equal(sensitiveStored, false, "Browser storage must never contain the member password");

  // Browser restart of the React view must recover session only from Spring.
  await page.reload({ waitUntil: "networkidle" });
  await expect(status).toHaveText("아직 서버 확인을 요청하지 않았습니다.");
  await page.getByRole("button", { name: "서버 세션 확인" }).click();
  await expect(status).toHaveText("서버에서 인증된 USER 회원");

  await page.getByRole("button", { name: "서버 로그아웃" }).click();
  await expect(status).toHaveText("서버 회원 로그인 안 됨");
  assert.deepEqual(paths.slice(-3), [
    "/api/v1/auth/csrf", "/api/v1/auth/logout", "/api/v1/auth/me",
  ]);

  await page.getByRole("button", { name: "서버 세션 확인" }).click();
  await expect(status).toHaveText("서버 회원 로그인 안 됨");
  assert.equal(paths.some(path => path.startsWith("/api/v1/youtube/")), false);

  process.stdout.write(JSON.stringify({
    schema: "YOUTOPIA_R04AO_CURRENT_REACT_SPRING_CHROMIUM_V01",
    status: "PASS",
    transport: "REAL_SPRING_SYNTHETIC_LOOPBACK",
    browser: "chromium",
    scope: "CSRF_LOGIN_ME_RELOAD_LOGOUT_GUEST_SECURE_COOKIE",
    providerRequestsMade: 0,
  }) + "\n");
  await context.close();
} finally {
  await browser.close();
}
