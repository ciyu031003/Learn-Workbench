// 生成 App 图标资源（v1.45 重写）。
//
// 背景：原实现直接拿设计稿 `fit: cover` 铺满整张方图，导致 legacy 图标
// （icon.png / ic_launcher.webp）里书本被四边裁切 —— 深色书页一路顶到边缘，
// 看起来就是"书本贴着边缘 + 一圈黑边"。真机反馈：「适当略微缩小一点书本的大小，
// 不要让它贴着边缘，同时也不要有黑边出现」。
//
// 现在的做法：
//   1) 取 `assets/images/android-icon-foreground.png` 作为**书本素材**（它带真实 alpha），
//      裁到内容外接框，得到一张干净的书本透明图；
//   2) 所有成品都是「背景 + 居中书本」，书本占画布比例 `ratio` 统一控制，
//      四周留出留白 → 不再有任何一边贴边；
//   3) Android 自适应图标的前景单独用 SAFE_RATIO（更小），保证落在 66% 安全区内，
//      被圆形/方形/水滴遮罩裁切时也不会切到书；
//   4) `ic_launcher_round` 生成真正的圆形版本（有些桌面直接用这张，不做遮罩）；
//   5) monochrome 由书本的 alpha 生成纯白剪影（Android 13+ 主题图标）。
//
// 已不在依赖 D:/Desktop 下的设计稿（那台机器上已不存在），改为从仓库内素材再生，
// 因此本脚本可重复执行、结果稳定。
//
// 用法: cd apps/mobile && node scripts/gen-icons.mjs
import sharp from "sharp";
import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(__dirname, "..");
const ASSETS = path.join(MOBILE, "assets", "images");
const RES = path.join(MOBILE, "android", "app", "src", "main", "res");
const BOOK_SRC = path.join(ASSETS, "android-icon-foreground.png");

/** 品牌底色（与原设计一致：暖白） */
const BRAND_BG = "#F7F5F2";
/** legacy 图标里书本占画布的比例：0.74 → 每边留 13% 留白 */
const LEGACY_RATIO = 0.74;
/** 圆形图标：书本要落在圆内，比例再收一点 */
const ROUND_RATIO = 0.64;
/** 自适应前景：Android 安全区是中间 66%，取 0.62 更稳 */
const SAFE_RATIO = 0.62;

/** 把书本素材裁到内容外接框，输出带 alpha 的 PNG buffer */
async function trimmedBook() {
  const buf = await sharp(BOOK_SRC).ensureAlpha().png().toBuffer();
  return sharp(buf).trim({ threshold: 1 }).png().toBuffer();
}

/** 生成 size×size 的「背景 + 居中书本」方图（ratio = 书本占画布比例） */
async function composeSquare(book, size, ratio) {
  const inner = Math.max(1, Math.round(size * ratio));
  const art = await sharp(book).resize(inner, inner, { fit: "inside" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BG } })
    .composite([{ input: art, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** 生成圆形版本（背景圆 + 居中书本） */
async function composeRound(book, size, ratio) {
  const square = await composeSquare(book, size, ratio);
  const mask = Buffer.from(
    '<svg width="' + size + '" height="' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + size / 2 + '" fill="#fff"/></svg>'
  );
  return sharp(square).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

/** 自适应前景：透明画布 + 居中书本（比例更小，避开遮罩裁切） */
async function composeForeground(book, size, ratio) {
  const inner = Math.max(1, Math.round(size * ratio));
  const art = await sharp(book).resize(inner, inner, { fit: "inside" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** 单色剪影：取书本的 alpha 作为形状，填纯白（Android 13+ 主题图标） */
async function composeMonochrome(book, size, ratio) {
  const inner = Math.max(1, Math.round(size * ratio));
  const art = await sharp(book).resize(inner, inner, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(art.data.length);
  for (let i = 0; i < art.data.length; i += 4) {
    out[i] = 255; out[i + 1] = 255; out[i + 2] = 255;
    out[i + 3] = art.data[i + 3];
  }
  const silhouette = await sharp(out, { raw: { width: art.info.width, height: art.info.height, channels: 4 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: silhouette, gravity: "centre" }])
    .png()
    .toBuffer();
}

const book = await trimmedBook();
const bm = await sharp(book).metadata();
console.log("book artwork trimmed:", bm.width + "x" + bm.height);

// 1) expo 侧资源
await sharp(await composeSquare(book, 1024, LEGACY_RATIO)).png().toFile(path.join(ASSETS, "icon.png"));
await sharp(await composeSquare(book, 1024, LEGACY_RATIO)).png().toFile(path.join(ASSETS, "splash-icon.png"));
await sharp(await composeSquare(book, 48, LEGACY_RATIO)).png().toFile(path.join(ASSETS, "favicon.png"));
await sharp(await composeSquare(book, 512, LEGACY_RATIO)).png().toFile(path.join(ASSETS, "android-icon-background.png"));
await sharp(await composeForeground(book, 512, SAFE_RATIO)).png().toFile(path.join(ASSETS, "android-icon-foreground.png"));
await sharp(await composeMonochrome(book, 432, SAFE_RATIO)).png().toFile(path.join(ASSETS, "android-icon-monochrome.png"));

// 2) Android 原生资源（真正打进 APK）
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const [d, size] of Object.entries(legacy)) {
  const dir = path.join(RES, "mipmap-" + d);
  await sharp(await composeSquare(book, size, LEGACY_RATIO)).webp({ quality: 100, lossless: true }).toFile(path.join(dir, "ic_launcher.webp"));
  await sharp(await composeRound(book, size, ROUND_RATIO)).webp({ quality: 100, lossless: true }).toFile(path.join(dir, "ic_launcher_round.webp"));
}

for (const [d, size] of Object.entries(adaptive)) {
  const dir = path.join(RES, "mipmap-" + d);
  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BG } })
    .webp({ lossless: true })
    .toFile(path.join(dir, "ic_launcher_background.webp"));
  await sharp(await composeForeground(book, size, SAFE_RATIO)).webp({ quality: 100, lossless: true }).toFile(path.join(dir, "ic_launcher_foreground.webp"));
  await sharp(await composeMonochrome(book, size, SAFE_RATIO)).webp({ lossless: true }).toFile(path.join(dir, "ic_launcher_monochrome.webp"));
}

console.log("icons generated OK");
