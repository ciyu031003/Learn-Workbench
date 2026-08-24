import { defineConfig } from "@playwright/test";
import path from "node:path";

// 读取 e2e/.env（若有）
import { loadEnv } from "./helpers/env";
const env = loadEnv();

const baseURL = (env.E2E_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const chromePath = env.E2E_CHROME_PATH || "";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./global-setup",
  use: {
    baseURL,
    viewport: { width: 1489, height: 911 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // 浏览器选择：E2E_CHROME_PATH 优先 → E2E_BROWSER=chromium 用 Playwright 自带 chromium（CI）→ 默认系统 Chrome
    ...(chromePath
      ? { executablePath: chromePath }
      : env.E2E_BROWSER === "chromium"
        ? {}
        : { channel: process.env.E2E_CHANNEL || "chrome" }),
  },
  outputDir: path.join(__dirname, "test-results"),
});
