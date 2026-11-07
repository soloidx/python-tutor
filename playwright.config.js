import { defineConfig } from "@playwright/test";
const port = process.env.PLAYWRIGHT_PORT || "4173";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
