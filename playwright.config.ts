import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 600_000,
  // Keep generous timing for complete UI flows and slower CI hosts.
  expect: { timeout: 150_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: /mobile\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", testMatch: /mobile\.spec\.ts/, use: { ...devices["iPhone 15"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "node --import tsx scripts/start-e2e-server.ts",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
