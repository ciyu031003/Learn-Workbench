/**
 * 李宁官方商城（store.lining.com，umi SPA）装备图爬取 —— 用 Playwright 渲染后取「商品名 + 商品图」。
 *
 * 用法：
 *   node scripts/crawl_lining.mjs [--dry] [--limit 40] [--out .local/equipment-out4]
 *
 * 说明：
 *  - 商城是 SPA 且接口需要签名/渠道头，这里直接渲染页面（chromium 已随 Playwright 装好）；
 *  - 商品图是腾讯 COS 图床，把 `imageMogr2/thumbnail/130x130/pad/1/color/...` 换成大图参数即可；
 *  - 白底判定与规范化复用与主爬虫一致的规则（先 flatten 到白底再采样）。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const CHROME =
  process.env.CHROME_PATH ??
  "C:/Users/yuan/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    const value = argv[i + 1];
    out[key.slice(2)] = value && !String(value).startsWith("--") ? value : true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const DRY = Boolean(args.dry);
const OUT_DIR = path.resolve(args.out ?? ".local/equipment-out4");
const PER_CATEGORY = Number(args.limit ?? 40);

/** 搜索关键词 → 我们的图库品类（覆盖我们能上装备行的项目） */
const TARGETS = [
  { keyword: "羽毛球拍", category: "badminton-racket" },
  { keyword: "羽毛球鞋", category: "badminton-shoes" },
  { keyword: "羽毛球线", category: "badminton-string" },
  { keyword: "羽毛球", category: "badminton-shuttle" },
  { keyword: "手胶", category: "badminton-accessory" },
  { keyword: "乒乓球拍", category: "table-tennis-racket" },
  { keyword: "乒乓球胶皮", category: "table-tennis-rubber" },
  { keyword: "乒乓球鞋", category: "table-tennis-shoes" },
  { keyword: "乒乓球", category: "table-tennis-ball" },
  { keyword: "篮球鞋", category: "basketball-shoes" },
  { keyword: "篮球", category: "basketball-ball" },
  { keyword: "足球鞋", category: "soccer-shoes" },
  { keyword: "足球", category: "soccer-ball" },
  { keyword: "护腿板", category: "soccer-guard" },
  { keyword: "排球鞋", category: "volleyball-shoes" },
  { keyword: "排球", category: "volleyball-ball" },
  { keyword: "护膝", category: "volleyball-knee" },
  { keyword: "网球拍", category: "tennis-racket" },
  { keyword: "网球鞋", category: "tennis-shoes" },
  { keyword: "网球", category: "tennis-ball" },
  { keyword: "棒球手套", category: "baseball-glove" },
  { keyword: "棒球棒", category: "baseball-bat" },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** 缩略图 → 大图（去掉 pad 灰底填充） */
function largeImageUrl(src) {
  const base = src.split("?")[0];
  return base + "?imageMogr2/thumbnail/1200x1200/quality/90/strip/format/webp";
}

async function isWhiteBackgroundProduct(buffer) {
  const { data, info } = await sharp(buffer, { failOn: "none" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize({ width: 320, height: 320, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const nearWhite = (i) => data[i] >= 232 && data[i + 1] >= 232 && data[i + 2] >= 232;
  let border = 0, borderWhite = 0, center = 0, centerInk = 0;
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.04));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const edge = x < band || y < band || x >= width - band || y >= height - band;
      if (edge) { border++; if (nearWhite(i)) borderWhite++; }
      else { center++; if (data[i] < 225 || data[i + 1] < 225 || data[i + 2] < 225) centerInk++; }
    }
  }
  return border > 0 && center > 0 && borderWhite / border >= 0.86 && centerInk / center >= 0.02;
}

async function normalizeProductImage(buffer) {
  const trimmed = await sharp(buffer, { failOn: "none" }).rotate().trim({ threshold: 14 }).toBuffer();
  return sharp(trimmed)
    .resize({ width: 900, height: 900, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .webp({ quality: 88, effort: 4 })
    .toBuffer({ resolveWithObject: true });
}

/** 渲染一个搜索词的结果页，抽取商品卡片（名称 + 主图） */
async function collectCards(page, keyword) {
  const url =
    "https://store.lining.com/goods/list?key=" + encodeURIComponent(keyword) + "&field=sales_num";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4500);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(900);
  }
  return page.evaluate(() => {
    const out = [];
    const imgs = [...document.querySelectorAll("img")].filter((i) => (i.currentSrc || i.src || "").includes("lining-goods-online"));
    for (const img of imgs) {
      const src = img.currentSrc || img.src || "";
      if (!src) continue;
      // 商品图：往上找带名称的卡片容器
      let node = img;
      let name = "";
      for (let depth = 0; depth < 6 && node; depth++) {
        node = node.parentElement;
        if (!node) break;
        const text = (node.innerText || "").trim();
        if (text.length >= 4 && text.length <= 120) { name = text.split("\n")[0].trim(); break; }
      }
      if (name) out.push({ name, src });
    }
    return out;
  });
}

async function main() {
  const imagesDir = path.join(OUT_DIR, "images");
  await mkdir(imagesDir, { recursive: true });
  const manifest = [];
  const seen = new Set();
  if (args.resume) {
    try {
      const prev = JSON.parse(await readFile(path.join(OUT_DIR, "manifest.json"), "utf8"));
      for (const item of prev) { manifest.push(item); seen.add(item.category + "|" + item.model); }
      console.log("[lining] resume：已有 " + manifest.length + " 条");
    } catch {}
  }

  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, locale: "zh-CN" });

  for (const target of TARGETS) {
    let cards = [];
    try {
      cards = await collectCards(page, target.keyword);
    } catch (error) {
      console.warn("[lining] 搜索失败 " + target.keyword + "：" + error.message);
      continue;
    }
    console.log("[lining] " + target.keyword + " → 候选 " + cards.length + " 个（目标品类 " + target.category + "）");
    let stored = 0;
    for (const card of cards) {
      if (stored >= PER_CATEGORY) break;
      const model = card.name.replace(/\s+/g, " ").trim();
      if (!model || model.length < 3) continue;
      // 排除非装备（包/服饰/袜/帽/毛巾…）：图库只放「能上装备行」的东西
      if (/球拍包|球包|背包|腰包|双肩|服饰|短裤|长裤|T恤|卫衣|上衣|外套|裙|袜|帽|毛巾|护腕|发带|手胶纸|贴纸/.test(model)) continue;
      const dedupe = target.category + "|" + model;
      if (seen.has(dedupe)) continue;
      const imageUrl = largeImageUrl(card.src);
      if (DRY) {
        console.log("  (dry) " + model.slice(0, 40) + " ← " + imageUrl.slice(0, 90));
        stored++;
        continue;
      }
      try {
        const res = await fetch(imageUrl, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://store.lining.com/" } });
        if (!res.ok) continue;
        const buffer = Buffer.from(await res.arrayBuffer());
        if (!(await isWhiteBackgroundProduct(buffer))) continue;
        const normalized = await normalizeProductImage(buffer);
        const relPath = path.posix.join(target.category, slugify("lining-" + model) + ".webp");
        await mkdir(path.join(imagesDir, target.category), { recursive: true });
        await writeFile(path.join(imagesDir, relPath), normalized.data);
        seen.add(dedupe);
        manifest.push({
          category: target.category,
          brand: "LI-NING",
          model,
          path: relPath,
          width: normalized.info.width ?? 0,
          height: normalized.info.height ?? 0,
          bytes: normalized.data.length,
          sourceUrl: "https://store.lining.com/goods/list?key=" + encodeURIComponent(target.keyword),
          sourceSite: "store.lining.com",
          imageSourceUrl: imageUrl,
          crawledAt: new Date().toISOString(),
        });
        await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
        stored++;
        console.log("  ✓ " + target.category + " " + model.slice(0, 32) + " (" + Math.round(normalized.data.length / 1024) + "KB)");
      } catch (error) {
        console.warn("  × " + error.message.slice(0, 60));
      }
    }
    await sleep(1500);
  }

  await browser.close();
  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log("[lining] 完成：" + manifest.length + " 条 → " + OUT_DIR);
  const byCategory = {};
  for (const item of manifest) byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  console.log("[lining] 分类分布：" + JSON.stringify(byCategory));
}

main().catch((error) => {
  console.error("[lining] 失败：" + (error?.stack ?? error));
  process.exit(1);
});
