#!/usr/bin/env node
/**
 * S6-5 axe 冒烟（可选门禁）：对运行中的 Web 做 WCAG 2.1 A/AA 扫描。
 *
 * 用法：
 *   node scripts/axe-smoke.mjs                         # 默认扫 / 与 /login（http://127.0.0.1:3001）
 *   AXE_BASE_URL=https://learn.yuanabd.cn node scripts/axe-smoke.mjs
 *   AXE_PAGES=/dashboard,/tasks node scripts/axe-smoke.mjs   # 需登录的页面请配合 cookies（见下）
 *
 * 说明：
 *  - 复用已有 playwright-core（apps/web 依赖）+ axe-core（仓库根已安装），**不新增依赖**；
 *  - 服务不可达 / 浏览器未安装 → SKIP（exit 0 并打印原因，不静默通过）；
 *  - 发现 serious/critical 违规 → exit 1，并逐条打印 selector + 修复建议链接。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BASE = process.env.AXE_BASE_URL || process.env.E2E_BASE_URL || "http://127.0.0.1:3001";
const RAW_PAGES = process.env.AXE_PAGES || "/,/login";
const PAGES = RAW_PAGES.split(",").map((p) => p.trim()).filter(Boolean);
const TIMEOUT = Number(process.env.AXE_TIMEOUT_MS || 15_000);

function skip(reason) {
  console.log("[axe-smoke] SKIP: " + reason);
  process.exit(0);
}

const axePath = path.join(ROOT, "node_modules", "axe-core", "axe.min.js");
if (!existsSync(axePath)) skip("未安装 axe-core（node_modules/axe-core/axe.min.js 不存在）");
const axeSource = readFileSync(axePath, "utf8");

let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  skip("未安装 playwright-core");
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (error) {
  skip("无法启动 Chromium（未安装浏览器二进制）：" + (error?.message ?? error));
}

let failed = false;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const route of PAGES) {
    const url = new URL(route, BASE).toString();
    try {
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
      if (res && res.status() >= 400) {
        console.log("[axe-smoke] " + url + " → HTTP " + res.status() + "（跳过该页）");
        continue;
      }
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        return await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
          rules: { "color-contrast": { enabled: true } },
        });
      });
      const violations = result.violations ?? [];
      const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      for (const v of violations) byImpact[v.impact ?? "minor"] = (byImpact[v.impact ?? "minor"] ?? 0) + 1;
      console.log("[axe-smoke] " + url + " → 违规 " + violations.length + " 条（critical=" + byImpact.critical + " serious=" + byImpact.serious + " moderate=" + byImpact.moderate + " minor=" + byImpact.minor + "）");
      for (const v of violations) {
        console.log("  - [" + v.impact + "] " + v.id + ": " + v.help + " → " + (v.nodes?.[0]?.target?.join(" ") ?? ""));
      }
      if (byImpact.critical + byImpact.serious > 0) failed = true;
    } catch (error) {
      console.log("[axe-smoke] " + url + " → 扫描失败：" + (error?.message ?? error));
      failed = true;
    }
  }
} finally {
  await browser.close();
}

if (failed) {
  console.error("[axe-smoke] FAIL：存在 serious/critical 违规（见上）");
  process.exit(1);
}
console.log("[axe-smoke] OK：serious=0 critical=0");
