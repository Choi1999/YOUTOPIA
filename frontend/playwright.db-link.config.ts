import { defineConfig, devices } from "@playwright/test";

// API responses are deliberately synthetic. Real Spring/DB tests use
// tools/test_services.py verify --with-browser and playwright.service.config.ts.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "db-link.spec.ts",
  outputDir: "test-results/db-link",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/db-link-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4186",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: process.env.YOUTOPIA_TEST_CHROME_PATH
      ? { executablePath: process.env.YOUTOPIA_TEST_CHROME_PATH }
      : {},
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --strictPort --port 4186",
    url: "http://127.0.0.1:4186",
    reuseExistingServer: false,
    env: { VITE_PRODUCT_EVENTS_ENABLED: "false" },
  },
});
