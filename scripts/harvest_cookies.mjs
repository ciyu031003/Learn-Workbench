#!/usr/bin/env node
/**
 * 招花 · 登录态 Cookie 采集器（猎聘 / 前程无忧 / 国聘网）
 *
 * 背景：Chrome 151 起 cookie 使用 v20 App-Bound 加密，无法从本地文件/复制 Profile 直接导出。
 *      本脚本用「真实浏览器手动登录一次」的方式，让 Chrome 自己解密并交给 Playwright 保存
 *      storageState（含 HttpOnly Cookie），供服务器爬虫复用。
 *
 * 用法（在本机有显示器的环境执行）：
 *   node scripts/harvest_cookies.mjs [--out config/job-hosts/storageState.json]
 *
 * 流程：
 *   1. 打开一个真实 Chrome 窗口（独立临时 Profile，不影响你日常 Chrome）
 *   2. 依次打开 猎聘 → 前程无忧 → 国聘网，请在弹出的窗口里登录
 *   3. 每登录完一个站点，回到本终端按回车继续
 *   4. 全部完成后自动保存 storageState 到指定路径
 *
 * ⚠️ 猎聘特殊说明：猎聘风控会把「被自动化控制的浏览器」清空成 about:blank，
 *    采集窗口里很可能无法登录。若脚本提示未检测到猎聘登录态（lt_auth），
 *    请用【手动导出】备用方案：
 *      a) 用你日常 Chrome 正常打开 https://www.liepin.com 并确认已登录；
 *      b) 按 F12 → Application → Storage → Cookies → https://www.liepin.com；
 *      c) 复制 lt_auth（以及 acw_tc 等）的 name=value 发给助手合并进 storageState。
 *
 * 环境变量：PLAYWRIGHT_CORE_PATH（可选，本地测试用），CHROMIUM_PATH / CHROME_PATH（可选指定浏览器）
 */
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import path from "node:path";
import { existsSync } from "node:fs";
const require = createRequire(import.meta.url);

let chromium = null;
try { chromium = require("playwright-core").chromium; } catch {}
if (!chromium) {
  const alt = process.env.PLAYWRIGHT_CORE_PATH;
  if (alt) { try { chromium = require(alt).chromium; } catch {} }
}
if (!chromium) {
  console.error("[fatal] 未找到 playwright-core，请先安装：pnpm --filter web add playwright-core（或 npm i playwright-core）");
  process.exit(1);
}

const arg = (name, d) => { const i = process.argv.indexOf(name); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const OUT = path.resolve(arg("--out", "config/job-hosts/storageState.json"));

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH || process.env.CHROMIUM_PATH || "",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];
const chromePath = CHROME_CANDIDATES.find((p) => p && existsSync(p));

const rl = createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q) => new Promise((r) => rl.question(q, r));

async function harvestOne(ctx, label, url, verify) {
  const page = await ctx.newPage();
  console.log("");
  console.log("===== " + label + " =====");
  console.log("请在浏览器窗口里打开并登录：" + url);
  console.log("（登录完成后回到本终端按回车继续；跳过请直接回车）");
  try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); } catch (e) { console.log("打开页面失败（可手动在窗口里打开）：" + (e && e.message ? e.message : e)); }
  await prompt(">>> 按回车继续… ");
  await page.waitForTimeout(1500);
  const cks = await ctx.cookies();
  console.log("[" + label + "] 当前上下文 cookie 数：" + cks.length);
  if (verify) {
    const ok = await verify(page, cks).catch(() => false);
    if (!ok) {
      console.log("");
      console.log("!! [" + label + "] 未检测到登录态！");
      console.log("   若页面被风控清空导致无法登录，请改用手动导出方案（见脚本头部说明），");
      console.log("   把 cookie 的 name=value 发给助手合并。");
    } else {
      console.log("[ok] [" + label + "] 已检测到登录态。");
    }
  }
  await page.close().catch(() => {});
}

async function main() {
  const launchOpts = { headless: false, args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"] };
  if (chromePath) launchOpts.executablePath = chromePath; else launchOpts.channel = "chrome";
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ locale: "zh-CN", viewport: { width: 1440, height: 900 } });

  await harvestOne(ctx, "猎聘", "https://c.liepin.com/", async (page, cks) => {
    const hasCookie = cks.some((c) => c.name === "lt_auth" || c.name === "liepin_login_valid");
    try {
      const ck = await page.evaluate(() => document.cookie || "");
      return hasCookie || /lt_auth|login_valid/.test(ck);
    } catch { return hasCookie; }
  });
  await harvestOne(ctx, "前程无忧", "https://we.51job.com/pc/search?keyword=前端工程师&searchType=2&jobArea=090200");
  await harvestOne(ctx, "国聘网(可选)", "https://www.iguopin.com/");

  await ctx.storageState({ path: OUT });
  const saved = JSON.parse(require("node:fs").readFileSync(OUT, "utf8"));
  console.log("");
  console.log("[done] 已保存登录态到：" + OUT);
  console.log("       cookie 数：" + saved.cookies.length);
  console.log("       域名：" + [...new Set(saved.cookies.map((c) => c.domain))].join(", "));
  await browser.close();
  rl.close();
}

main().catch((e) => { console.error("[error]", e); process.exit(1); });
