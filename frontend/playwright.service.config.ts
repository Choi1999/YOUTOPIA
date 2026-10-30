import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/service",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/service-results.json" }],
  ],
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "real-service",
      testMatch: "service.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        colorScheme: "dark",
      },
    },
    ...(["dark", "light"] as const).flatMap((colorScheme) => [
      {
        name: "visual-desktop-" + colorScheme,
        testMatch: "service.visual.spec.ts",
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 1280, height: 900 },
          colorScheme,
        },
      },
      {
        name: "visual-mobile-" + colorScheme,
        testMatch: "service.visual.spec.ts",
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 390, height: 844 },
          colorScheme,
        },
      },
    ]),
  ],
});
