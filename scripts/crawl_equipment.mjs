/**
 * 装备图库爬取（v11 P1.5）：只收「白底商品图」，统一裁边 + 铺白底 → WebP。
 *
 * 用法：
 *   node scripts/crawl_equipment.mjs [--sites yonex] [--limit 60] [--out .local/equipment-out]
 *
 * 设计要点：
 *  - **每个站点一个适配器**（可插拔）；当前实现 YONEX 中国官网（服务端渲染，好抓且图是白底商品图）；
 *  - 只保留白底图：采样四条边框判断背景是否近白，中心区域要有内容，否则整条丢弃（宁缺毋滥）；
 *  - 限速 ≥1.2s/请求 + 失败退避；只抓公开页面，不登录、不绕验证码；
 *  - 产出 `.local/equipment-out/{images,manifest.json}`，由 `scripts/import_equipment.mjs` 推桶入库。
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const DELAY_MS = 1200;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = path.resolve(args.out ?? ".local/equipment-out");
const LIMIT = Number(args.limit ?? 60);
const SITES = String(args.sites ?? "yonex").split(",").map((s) => s.trim());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" } });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://www.yonex.cn/" } });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return Buffer.from(await res.arrayBuffer());
}

/** 背景近白 + 主体有内容 → 判定为白底商品图 */
async function isWhiteBackgroundProduct(buffer) {
  const { data, info } = await sharp(buffer).resize({ width: 320, height: 320, fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const nearWhite = (i) => data[i] >= 238 && data[i + 1] >= 238 && data[i + 2] >= 238;
  let border = 0;
  let borderWhite = 0;
  let center = 0;
  let centerInk = 0;
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.04));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const edge = x < band || y < band || x >= width - band || y >= height - band;
      if (edge) {
        border++;
        if (nearWhite(i)) borderWhite++;
      } else {
        center++;
        if (data[i] < 225 || data[i + 1] < 225 || data[i + 2] < 225) centerInk++;
      }
    }
  }
  const borderRatio = border > 0 ? borderWhite / border : 0;
  const inkRatio = center > 0 ? centerInk / center : 0;
  return borderRatio >= 0.86 && inkRatio >= 0.02;
}

/** 裁掉白边 → 居中铺白底 → WebP */
async function normalizeProductImage(buffer) {
  const trimmed = await sharp(buffer, { failOn: "none" }).rotate().trim({ threshold: 14 }).toBuffer();
  const result = await sharp(trimmed)
    .resize({ width: 900, height: 900, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .webp({ quality: 88, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return result;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** 分类中文名 → 我们的 category key */
const CATEGORY_MAP = {
  羽毛球拍: "badminton-racket",
  羽毛球鞋: "badminton-shoes",
  羽毛球线: "badminton-string",
  羽毛球: "badminton-shuttle",
  羽毛球配件: "badminton-accessory",
};

/** YONEX 适配器：首页导航拿到分类 id，再逐类抓商品详情 */
const yonexAdapter = {
  key: "yonex",
  brand: "YONEX",
  base: "https://www.yonex.cn",
  async categories() {
    const home = await fetchText(this.base + "/");
    const found = new Map();
    for (const m of home.matchAll(/href="\/home\/index\/mall_list\/id\/(\d+)"[^>]*>([^<]+)</g)) {
      const name = m[2].trim();
      if (CATEGORY_MAP[name] && !found.has(name)) found.set(name, m[1]);
    }
    return [...found.entries()].map(([name, id]) => ({ id, name, category: CATEGORY_MAP[name] }));
  },
  async products(categoryId) {
    const html = await fetchText(this.base + "/home/index/mall_list/id/" + categoryId);
    const ids = [...new Set([...html.matchAll(/href="\/home\/index\/mall_detail\/id\/(\d+)"/g)].map((m) => m[1]))];
    return ids.map((id) => ({ id, url: this.base + "/home/index/mall_detail/id/" + id }));
  },
  async detail(url) {
    const html = await fetchText(url);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const model = title.replace(/^Yonex[-\s]*/i, "").replace(/羽毛球拍|羽毛球鞋|羽毛球线|羽毛球$|羽毛球配件/g, "").trim();
    const images = [...new Set([...html.matchAll(/<img[^>]+src="([^"]*\/public\/uploads\/[^"]+)"/g)].map((m) => m[1]))]
      .slice(0, 4)
      .map((src) => (src.startsWith("//") ? "https:" + src : src.startsWith("/") ? this.base + src : src));
    return { model, images };
  },
};

const ADAPTERS = { yonex: yonexAdapter };

async function main() {
  const imagesDir = path.join(OUT_DIR, "images");
  await mkdir(imagesDir, { recursive: true });
  const manifest = [];
  const seen = new Set();

  for (const siteKey of SITES) {
    const adapter = ADAPTERS[siteKey];
    if (!adapter) {
      console.warn("[crawl] 未知站点，跳过：" + siteKey);
      continue;
    }
    console.log("[crawl] 站点 " + siteKey + "（" + adapter.brand + "）");
    const categories = await adapter.categories();
    console.log("[crawl] 命中分类：" + categories.map((c) => c.name).join("/"));

    for (const category of categories) {
      if (manifest.length >= LIMIT) break;
      await sleep(DELAY_MS);
      let products = [];
      try {
        products = await adapter.products(category.id);
      } catch (error) {
        console.warn("[crawl] 列表失败 " + category.name + "：" + error.message);
        continue;
      }
      console.log("[crawl] " + category.name + " 商品 " + products.length + " 个");

      for (const product of products) {
        if (manifest.length >= LIMIT) break;
        await sleep(DELAY_MS);
        let detail;
        try {
          detail = await adapter.detail(product.url);
        } catch (error) {
          console.warn("[crawl] 详情失败 " + product.url + "：" + error.message);
          continue;
        }
        const model = detail.model || "未命名";
        const dedupe = category.category + "|" + model;
        if (seen.has(dedupe)) continue;

        for (const imageUrl of detail.images) {
          try {
            await sleep(300);
            const buffer = await fetchBuffer(imageUrl);
            if (!(await isWhiteBackgroundProduct(buffer))) continue;
            const normalized = await normalizeProductImage(buffer);
            const fileName = slugify(adapter.brand + "-" + model) + ".webp";
            const relPath = path.posix.join(category.category, fileName);
            await mkdir(path.join(imagesDir, category.category), { recursive: true });
            await writeFile(path.join(imagesDir, relPath), normalized.data);
            seen.add(dedupe);
            manifest.push({
              category: category.category,
              brand: adapter.brand,
              model,
              path: relPath,
              width: normalized.info.width ?? 0,
              height: normalized.info.height ?? 0,
              bytes: normalized.data.length,
              sourceUrl: product.url,
              sourceSite: new URL(adapter.base).host,
              imageSourceUrl: imageUrl,
              crawledAt: new Date().toISOString(),
            });
            console.log("  ✓ " + category.category + " " + model + " (" + Math.round(normalized.data.length / 1024) + "KB)");
            break;
          } catch (error) {
            console.warn("  × 图片失败：" + error.message);
          }
        }
      }
    }
  }

  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log("[crawl] 完成：" + manifest.length + " 条 → " + OUT_DIR);
  const byCategory = {};
  for (const item of manifest) byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  console.log("[crawl] 分类分布：" + JSON.stringify(byCategory));
}

main().catch((error) => {
  console.error("[crawl] 失败：" + (error?.stack ?? error));
  process.exit(1);
});
