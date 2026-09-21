// 用法: node scripts/uiverse/screenshot-sheets.mjs [--dir .local/uiverse/sheets] [--only picks]
// 用本机 Playwright(Chromium) 把拼版页逐张截图，便于直接在对话里看效果。
// 注意：Playwright 必须用 http 提供页面（file:// 的 iframe 在 Chromium 里会被拦成"破图"）。
// Chromium 可执行文件优先取 PLAYWRIGHT_CHROMIUM_PATH，其次自动扫描 ms-playwright 目录。
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const DIR = path.resolve(arg("dir", ".local/uiverse/sheets"));
const ONLY = arg("only", "");
const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
// 服务器根 = 拼版目录的上一级（拼版里的 iframe 用相对路径指回 elements/）
const ROOT = path.dirname(DIR);

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const base = path.join(os.homedir(), "AppData/Local/ms-playwright");
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().reverse();
  for (const d of dirs) {
    for (const rel of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe", "chrome-linux/chrome"]) {
      const p = path.join(base, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1340, height: 1200 }, deviceScaleFactor: 1.2 });
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".html") && (!ONLY || f.includes(ONLY)));
for (const f of files) {
  await page.goto("http://127.0.0.1:" + port + "/" + path.basename(DIR) + "/" + f, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const png = path.join(DIR, f.replace(/\.html$/, ".png"));
  await page.screenshot({ path: png, fullPage: true });
  console.log("截图 ->", path.relative(process.cwd(), png));
}
await browser.close();
server.close();
