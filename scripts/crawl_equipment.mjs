/**
 * 装备图库爬取（v11 P1.5+ 扩品牌/品类）：只收「白底商品图」，统一裁边 + 铺白底 → WebP。
 *
 * 用法：
 *   node scripts/crawl_equipment.mjs [--sites yonex-global,yonex,victor,doublefish,kawasaki] [--limit 300] [--out .local/equipment-out]
 *
 * 契约（加站点只写一个适配器）：
 *   categories()            → [{ id, name, category }]
 *   products(categoryId)    → [{ key, pageUrl, name?, imageUrl? }]（可跨页）
 *   detail(product)         → { model, images: string[], sourceUrl? }
 *
 * 设计要点：
 *  - 只保留白底图：采样四条边框判断背景是否近白，中心区域要有内容，否则整条丢弃（宁缺毋滥）；
 *  - 限速 ≥1.2s/请求 + 失败退避；只抓公开页面，不登录、不绕验证码；
 *  - 产出 `.local/equipment-out/{images,manifest.json}`，由 `scripts/import_equipment.mjs` 推桶入库。
 */
import { createHash } from "node:crypto";
import { matchesCategory } from "./lib/equipment-category.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const DELAY_MS = 1200;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    const next = argv[i + 1];
    // 无值开关（--resume / --dry）：下一个 token 若也是 -- 开头就不吃它
    if (next && !next.startsWith("--")) {
      out[key.slice(2)] = next;
      i++;
    } else {
      out[key.slice(2)] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = path.resolve(args.out ?? ".local/equipment-out");
const LIMIT = Number(args.limit ?? 300);
const SITES = String(args.sites ?? "yonex-global,yonex").split(",").map((s) => s.trim()).filter(Boolean);
/** 只抓某一类运动（badminton / tennis / all）—— 品类前缀过滤 */
const ONLY = String(args.only ?? "all");
const categoryAllowed = (key) => ONLY === "all" || key.startsWith(ONLY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" } });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return res.text();
}

async function fetchBuffer(url, referer) {
  const headers = { "User-Agent": UA };
  // Referer 必须是 ASCII（Node 的 fetch 拒绝非 ASCII 头值）：中文商品页 URL 先 percent-encode，仍不行就不带
  const ref = referer ? encodeURI(referer) : "";
  if (/^[\x20-\x7E]*$/.test(ref)) headers.Referer = ref || "https://www.yonex.com/";
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return Buffer.from(await res.arrayBuffer());
}

/** 背景近白 + 主体有内容 → 判定为白底商品图 */
async function isWhiteBackgroundProduct(buffer) {
  // ⚠️ 必须先 flatten 到白底：Magento 商品图常是透明 PNG，直接 removeAlpha 会被当黑底而误杀
  const { data, info } = await sharp(buffer, { failOn: "none" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize({ width: 320, height: 320, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
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
  return sharp(trimmed)
    .resize({ width: 900, height: 900, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .webp({ quality: 88, effort: 4 })
    .toBuffer({ resolveWithObject: true });
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------ YONEX 全球官网（Magento，品类全） ------------------------------ */

const yonexGlobalAdapter = {
  key: "yonex-global",
  brand: "YONEX",
  base: "https://www.yonex.com",
  async categories() {
    return [
      { id: "/badminton/racquets", name: "羽毛球拍", category: "badminton-racket" },
      { id: "/badminton/footwear", name: "羽毛球鞋", category: "badminton-shoes" },
      { id: "/badminton/strings", name: "羽毛球线", category: "badminton-string" },
      { id: "/badminton/shuttlecocks", name: "羽毛球", category: "badminton-shuttle" },
      { id: "/badminton/accessories", name: "羽毛球配件", category: "badminton-accessory" },
      { id: "/tennis/racquets", name: "网球拍", category: "tennis-racket" },
      { id: "/tennis/footwear", name: "网球鞋", category: "tennis-shoes" },
      { id: "/tennis/strings", name: "网球线", category: "tennis-string" },
      { id: "/tennis/balls", name: "网球", category: "tennis-ball" },
    ];
  },
  async products(categoryId) {
    const out = [];
    const seenName = new Set();
    for (let page = 1; page <= 12; page++) {
      const url = this.base + categoryId + "?product_list_limit=36" + (page > 1 ? "&p=" + page : "");
      let html = "";
      try {
        html = await fetchText(url);
      } catch (error) {
        break;
      }
      const cards = html.split(/<li class="item product product-item"/).slice(1);
      let added = 0;
      for (const card of cards) {
        const name = card.match(/product-item-link[^>]*>\s*([^<]{2,90})</)?.[1]?.trim();
        const imgPath = card.match(/\/media\/catalog\/product\/[^"'\s]+?\.(?:jpg|jpeg|png|webp)/i)?.[0];
        if (!name || !imgPath || seenName.has(name)) continue;
        seenName.add(name);
        out.push({
          key: name,
          pageUrl: url,
          name,
          // 列表图是 240×300 缩略图：改 query 直接要 1200 大图
          imageUrl: this.base + imgPath + "?quality=90&fit=bounds&height=1200&width=1200",
        });
        added++;
      }
      if (added === 0) break;
      await sleep(DELAY_MS);
    }
    return out;
  },
  async detail(product) {
    return { model: product.name, images: [product.imageUrl], sourceUrl: product.pageUrl };
  },
};

/* ------------------------------ YONEX 中国官网（服务端渲染，中文型号） ------------------------------ */

const CATEGORY_MAP_CN = {
  羽毛球拍: "badminton-racket",
  羽毛球鞋: "badminton-shoes",
  羽毛球线: "badminton-string",
  羽毛球: "badminton-shuttle",
  羽毛球配件: "badminton-accessory",
};

const yonexCnAdapter = {
  key: "yonex",
  brand: "YONEX",
  base: "https://www.yonex.cn",
  async categories() {
    const home = await fetchText(this.base + "/");
    const found = new Map();
    for (const m of home.matchAll(/href="\/home\/index\/mall_list\/id\/(\d+)"[^>]*>([^<]+)</g)) {
      const name = m[2].trim();
      if (CATEGORY_MAP_CN[name] && !found.has(name)) found.set(name, m[1]);
    }
    return [...found.entries()].map(([name, id]) => ({ id, name, category: CATEGORY_MAP_CN[name] }));
  },
  async products(categoryId) {
    const html = await fetchText(this.base + "/home/index/mall_list/id/" + categoryId);
    const ids = [...new Set([...html.matchAll(/href="\/home\/index\/mall_detail\/id\/(\d+)"/g)].map((m) => m[1]))];
    return ids.map((id) => ({ key: id, pageUrl: this.base + "/home/index/mall_detail/id/" + id }));
  },
  async detail(product) {
    const html = await fetchText(product.pageUrl);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const model = title.replace(/^Yonex[-\s]*/i, "").replace(/羽毛球拍|羽毛球鞋|羽毛球线|羽毛球$|羽毛球配件/g, "").trim();
    const images = [...new Set([...html.matchAll(/<img[^>]+src="([^"]*\/public\/uploads\/[^"]+)"/g)].map((m) => m[1]))]
      .slice(0, 4)
      .map((src) => (src.startsWith("//") ? "https:" + src : src.startsWith("/") ? this.base + src : src));
    return { model, images, sourceUrl: product.pageUrl };
  },
};

/* ------------------------------ VICTOR 全球官网（sitemap + og 元数据） ------------------------------ */

const victorAdapter = {
  key: "victor",
  brand: "VICTOR",
  base: "https://www.victorsport.com",
  mode: "classify",
  // 目标品类的上限（按关键词判定，逐条决定 category）
  async categories() {
    return [
      { category: "badminton-racket", name: "球拍", cap: 80 },
      { category: "badminton-shoes", name: "球鞋", cap: 60 },
      { category: "badminton-string", name: "拍线", cap: 40 },
      { category: "badminton-shuttle", name: "羽毛球", cap: 25 },
      { category: "badminton-accessory", name: "配件/手胶", cap: 40 },
    ];
  },
  async allProducts() {
    const xml = await fetchText(this.base + "/sitemap_products.xml");
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).map((url) => ({ key: url, pageUrl: url, url }));
  },
  async detail(product) {
    const html = await fetchText(product.pageUrl);
    const title = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const model = title.split("|")[0].trim();
    const imageUrl = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1] ?? null;
    const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    const text = (title + " " + desc).toLowerCase();
    let category = null;
    if (/racket|racquet/.test(text)) category = "badminton-racket";
    else if (/shoes?\b|footwear/.test(text)) category = "badminton-shoes";
    else if (/\bstring\b|string\b/.test(text)) category = "badminton-string";
    else if (/shuttlecock/.test(text)) category = "badminton-shuttle";
    else if (/grip|overgrip|wrist|headband|towel|accessor/.test(text)) category = "badminton-accessory";
    return { model, images: imageUrl ? [imageUrl] : [], sourceUrl: product.pageUrl, category };
  },
};

/* ------------------------------ 双鱼（国产：乒乓球全套 + 足篮排 + 羽毛球拍） ------------------------------ */

const doubleFishAdapter = {
  key: "doublefish",
  brand: "双鱼",
  base: "https://www.doublefish.com",
  async categories() {
    // 分类页 URL 形如 /底板_c18；商品卡形如 <a href="/诗雯sw系列底板_p175" title="诗雯SW系列底板"><img src="…_thumb.jpg">
    return [
      { id: "/底板_c18", name: "双鱼底板", category: "table-tennis-racket" },
      { id: "/乒乓球拍_c20", name: "双鱼成品拍", category: "table-tennis-racket" },
      { id: "/套胶_c19", name: "双鱼套胶", category: "table-tennis-rubber" },
      { id: "/乒乓球_c17", name: "双鱼乒乓球", category: "table-tennis-ball" },
      { id: "/羽毛球拍系列_c23", name: "双鱼羽毛球拍", category: "badminton-racket" },
      { id: "/长虹足球_c4", name: "双鱼足球", category: "soccer-ball" },
      { id: "/长虹篮球_c14", name: "双鱼篮球", category: "basketball-ball" },
      { id: "/长虹排球_c15", name: "双鱼排球", category: "volleyball-ball" },
    ];
  },
  async products(categoryId) {
    const html = await fetchText(this.base + encodeURI(categoryId));
    const out = [];
    const seen = new Set();
    for (const m of html.matchAll(/<a href="([^"]*_p\d+)" title="([^"]*)">\s*<img[^>]+src="([^"]+)"/g)) {
      const model = m[2].replace(/\s+/g, " ").trim();
      if (!model || seen.has(model)) continue;
      seen.add(model);
      const abs = m[3].startsWith("http") ? m[3] : this.base + m[3];
      // 列表图是 _thumb 缩略图：换成 _medium 大图（原图 500，不开放）
      // pageUrl 用 encodeURI：中文 slug 直接进 Referer 头会被 Node 拒绝
      out.push({
        key: m[1],
        pageUrl: this.base + encodeURI(m[1]),
        name: model,
        imageUrl: abs.replace(/_thumb\.(jpg|jpeg|png)$/i, "_medium.$1"),
      });
    }
    return out;
  },
  async detail(product) {
    return { model: product.name, images: [product.imageUrl], sourceUrl: product.pageUrl };
  },
};

/* ------------------------------ 川崎（欧洲官方店 kawasaki-sport.eu，商品图带型号名） ------------------------------ */

const kawasakiAdapter = {
  key: "kawasaki",
  brand: "川崎",
  base: "https://kawasaki-sport.eu",
  async categories() {
    return [
      { id: "/en/menu/rackets-178.html", name: "川崎球拍", category: "badminton-racket" },
      { id: "/en/menu/shoes-182.html", name: "川崎球鞋", category: "badminton-shoes" },
      { id: "/en/menu/strings-190.html", name: "川崎拍线", category: "badminton-string" },
      { id: "/en/menu/grips-189.html", name: "川崎手胶", category: "badminton-accessory" },
      { id: "/en/menu/accessories-187.html", name: "川崎配件", category: "badminton-accessory" },
    ];
  },
  async products(categoryId) {
    const html = await fetchText(this.base + categoryId);
    const out = [];
    const seen = new Set();
    const re = /<a[^>]+href="(https:\/\/kawasaki-sport\.eu\/en\/products\/[^"]+)"[^>]*title="([^"]+)"[\s\S]{0,600}?<img[^>]+src="([^"]+)"/g;
    for (const m of html.matchAll(re)) {
      const model = m[2].replace(/\s+/g, " ").trim();
      if (!model || seen.has(model)) continue;
      seen.add(model);
      const abs = m[3].startsWith("http") ? m[3] : this.base + m[3];
      out.push({ key: m[1], pageUrl: m[1], name: model, imageUrl: abs });
    }
    return out;
  },
  async detail(product) {
    return { model: product.name, images: [product.imageUrl], sourceUrl: product.pageUrl };
  },
};

/* ------------------------------ 蝴蝶（日本官网 butterfly.co.jp：底板 / 胶皮 / 球鞋 / 球） ------------------------------ */

const butterflyAdapter = {
  key: "butterfly",
  brand: "蝴蝶",
  base: "https://www.butterfly.co.jp",
  async categories() {
    return [
      { id: "/products/blade/", name: "蝴蝶底板", category: "table-tennis-racket" },
      { id: "/products/rubber/", name: "蝴蝶胶皮", category: "table-tennis-rubber" },
      { id: "/products/shoes/", name: "蝴蝶球鞋", category: "table-tennis-shoes" },
      { id: "/products/ball/", name: "蝴蝶乒乓球", category: "table-tennis-ball" },
    ];
  },
  async products(categoryId) {
    const html = await fetchText(this.base + categoryId);
    const out = [];
    const seen = new Set();
    // 列表卡：<a href="/products/detail/37221.html" class="card"> … <img src="/products/item/37221.jpg" alt="樊振東 ALC">
    const re = /<a href="(\/products\/detail\/\d+\.html)" class="card">[\s\S]{0,400}?<img src="([^"]+)" alt="([^"]*)"/g;
    for (const m of html.matchAll(re)) {
      const model = (m[3] || "").trim();
      if (!model || seen.has(model)) continue;
      seen.add(model);
      const thumb = m[2].startsWith("http") ? m[2] : this.base + m[2];
      // 缩略图 600×600 → 详情图 _01 是 1200×1200
      out.push({
        key: m[1],
        pageUrl: this.base + m[1],
        name: model,
        imageUrl: thumb.replace(/\.(jpg|jpeg|png)$/i, "_01.$1"),
      });
    }
    return out;
  },
  async detail(product) {
    return { model: product.name, images: [product.imageUrl], sourceUrl: product.pageUrl };
  },
};

const ADAPTERS = {
  "yonex-global": yonexGlobalAdapter,
  yonex: yonexCnAdapter,
  victor: victorAdapter,
  doublefish: doubleFishAdapter,
  kawasaki: kawasakiAdapter,
  butterfly: butterflyAdapter,
};

/** 下载一张图 → 白底判定 → 裁边铺白 → 落盘 + 记 manifest（成功返回 true） */
async function storeItem({ adapter, category, model, imageUrl, sourceUrl, imagesDir, seen, manifest }) {
  const dedupe = category + "|" + model;
  if (seen.has(dedupe)) return false;
  // 品类守卫：抓到了「球鞋」却要存进「球」分类这类错误，直接跳过（服装/周边也在这里挡掉）
  if (!matchesCategory(category, model)) {
    console.warn("  × 品类不符，跳过：" + category + " ← " + model.slice(0, 30));
    return false;
  }
  try {
    const buffer = await fetchBuffer(imageUrl, sourceUrl);
    if (!(await isWhiteBackgroundProduct(buffer))) return false;
    const normalized = await normalizeProductImage(buffer);
    // 文件名：中文型号 slug 化后会退化（「1615长胶专业版」与「1615诡胶王」都只剩 1615，互相覆盖），
    // 只要型号含 CJK 或 slug 太短，就补 6 位 hash 保证唯一（拉丁型号维持干净文件名）
    const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
    const asciiSlug =
      slugify(adapter.brand + "-" + model) || slugify((sourceUrl.split("/").pop() ?? "").split("?")[0]);
    const fileBase =
      CJK.test(model) || asciiSlug.length < 3
        ? (asciiSlug || "item") + "-" + createHash("sha1").update(model + "|" + sourceUrl).digest("hex").slice(0, 6)
        : asciiSlug;
    const relPath = path.posix.join(category, fileBase + ".webp");
    await mkdir(path.join(imagesDir, category), { recursive: true });
    await writeFile(path.join(imagesDir, relPath), normalized.data);
    seen.add(dedupe);
    manifest.push({
      category,
      brand: adapter.brand,
      model,
      path: relPath,
      width: normalized.info.width ?? 0,
      height: normalized.info.height ?? 0,
      bytes: normalized.data.length,
      sourceUrl,
      sourceSite: new URL(adapter.base).host,
      imageSourceUrl: imageUrl,
      crawledAt: new Date().toISOString(),
    });
    console.log("  ✓ " + category + " " + model + " (" + Math.round(normalized.data.length / 1024) + "KB)");
    // 每命中一条就落盘：长跑被中断也不会丢已抓数据（下次可用 --resume 跳过）
    await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    return true;
  } catch (error) {
    console.warn("  × 图片失败：" + error.message);
    return false;
  }
}

async function main() {
  const imagesDir = path.join(OUT_DIR, "images");
  await mkdir(imagesDir, { recursive: true });
  const manifest = [];
  const seen = new Set();
  /** --resume：把上次 manifest 读进来，跳过已抓过的（型号 + 分类） */
  if (args.resume) {
    try {
      const previous = JSON.parse(await readFile(path.join(OUT_DIR, "manifest.json"), "utf8"));
      for (const item of previous) {
        manifest.push(item);
        seen.add(item.category + "|" + item.model);
      }
      console.log("[crawl] resume：已有 " + manifest.length + " 条，继续补抓");
    } catch {
      console.log("[crawl] resume：没有可用 manifest，从头抓");
    }
  }

  for (const siteKey of SITES) {
    const adapter = ADAPTERS[siteKey];
    if (!adapter) {
      console.warn("[crawl] 未知站点，跳过：" + siteKey);
      continue;
    }

    /* ---- 逐条判定品类模式（VICTOR：sitemap 全量扫描 + 关键词分类） ---- */
    if (adapter.mode === "classify") {
      const targets = (await adapter.categories()).filter((t) => categoryAllowed(t.category));
      console.log(
        "[crawl] 站点 " + siteKey + "（" + adapter.brand + "）按关键词判定品类：" + targets.map((t) => t.name + "≤" + t.cap).join("/")
      );
      const counts = {};
      const products = await adapter.allProducts();
      console.log("[crawl] sitemap 商品 " + products.length + " 条，开始扫描");
      for (const product of products) {
        if (manifest.length >= LIMIT) break;
        if (targets.every((t) => (counts[t.category] ?? 0) >= t.cap)) break;
        await sleep(DELAY_MS);
        let detail;
        try {
          detail = await adapter.detail(product);
        } catch {
          continue;
        }
        const target = targets.find((t) => t.category === detail.category);
        if (!target || (counts[target.category] ?? 0) >= target.cap) continue;
        const model = (detail.model || "未命名").trim();
        for (const imageUrl of detail.images ?? []) {
          await sleep(300);
          const ok = await storeItem({
            adapter,
            category: target.category,
            model,
            imageUrl,
            sourceUrl: detail.sourceUrl ?? product.pageUrl,
            imagesDir,
            seen,
            manifest,
          });
          if (ok) {
            counts[target.category] = (counts[target.category] ?? 0) + 1;
            break;
          }
        }
      }
      console.log("[crawl] " + siteKey + " 命中：" + JSON.stringify(counts));
      continue;
    }

    /* ---- 分类枚举模式（YONEX：分类 → 商品列表 → 详情） ---- */
    console.log("[crawl] 站点 " + siteKey + "（" + adapter.brand + "）");
    const categories = (await adapter.categories()).filter((c) => categoryAllowed(c.category));
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
          detail = await adapter.detail(product);
        } catch (error) {
          console.warn("[crawl] 详情失败 " + product.pageUrl + "：" + error.message);
          continue;
        }
        const model = (detail.model || product.name || "未命名").trim();
        for (const imageUrl of detail.images ?? []) {
          await sleep(300);
          const ok = await storeItem({
            adapter,
            category: category.category,
            model,
            imageUrl,
            sourceUrl: detail.sourceUrl ?? product.pageUrl,
            imagesDir,
            seen,
            manifest,
          });
          if (ok) break;
        }
      }
    }
  }

  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log("[crawl] 完成：" + manifest.length + " 条 → " + OUT_DIR);
  const byCategory = {};
  const byBrand = {};
  for (const item of manifest) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    byBrand[item.brand] = (byBrand[item.brand] ?? 0) + 1;
  }
  console.log("[crawl] 分类分布：" + JSON.stringify(byCategory));
  console.log("[crawl] 品牌分布：" + JSON.stringify(byBrand));
}

main().catch((error) => {
  console.error("[crawl] 失败：" + (error?.stack ?? error));
  process.exit(1);
});
