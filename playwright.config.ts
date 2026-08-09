import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Disable fullyParallel to ensure emulator interactions are execution-deterministic
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Limit to 1 worker because the local single-instance Firebase Emulator
  // has shared global state (local emulator storage and ports).
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173/fairtab/",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/fairtab/",
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
