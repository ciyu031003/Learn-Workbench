/**
 * 内容图优化管线的纯逻辑（S3-5）。
 *
 * 设计约束：
 *  1. **绝不放大**：候选宽度只取「小于原图」的档位；原图比最小档还小则用原图宽度出一档。
 *  2. **命名可推导**：`foo.png` → `foo@640w.webp`，便于 nginx 直出、CDN 缓存与人工排查。
 *  3. **清单自描述**：清单里写死每个变体的 URL 与宽高，前端只查表、不猜命名。
 *  4. 本文件不 import sharp / fs，纯函数，可直接被 node:test 与脚本复用。
 */

/** 默认目标宽度（卡面/题目图按 2 档即可覆盖移动端与桌面端） */
export const DEFAULT_WIDTHS = [640, 1280];

/** 默认 WebP 质量：题目图多为线稿+中文标注，84 在体积与清晰度间比较稳 */
export const DEFAULT_QUALITY = 84;

/** `foo.png` → `foo@640w.webp`（保留原始 stem，含构建 hash 后缀） */
export function variantFileName(fileName, width) {
  if (!fileName || typeof fileName !== "string") throw new Error("variantFileName: fileName 必填");
  if (!Number.isInteger(width) || width <= 0) throw new Error("variantFileName: width 必须是正整数");
  const stem = fileName.replace(/\.(png|PNG)$/, "");
  return `${stem}@${width}w.webp`;
}

/** 清单键：数据库里存的图片 URL（/content-images/xxx.png），保证前端查表时零猜测 */
export function manifestKey(fileName) {
  if (!fileName || typeof fileName !== "string") throw new Error("manifestKey: fileName 必填");
  return `/content-images/${fileName}`;
}

/**
 * 给定原图固有宽度，返回真正要生成的变体宽度（升序、去重、不放大）。
 * - 原图 1600 → [640, 1280]
 * - 原图 700  → [640]
 * - 原图 500  → [500]（用它自己的宽度，避免把 500 的图放大成 640）
 */
export function widthsForIntrinsic(intrinsicWidth, widths = DEFAULT_WIDTHS) {
  if (!Number.isFinite(intrinsicWidth) || intrinsicWidth <= 0) throw new Error("widthsForIntrinsic: 宽度非法");
  const candidates = [...new Set(widths)]
    .filter((w) => Number.isInteger(w) && w > 0)
    .sort((a, b) => a - b)
    .filter((w) => w < intrinsicWidth);
  return candidates.length > 0 ? candidates : [Math.round(intrinsicWidth)];
}

/** 单张图的优化计划：{ fileName, intrinsicWidth, widths } */
export function planFile(fileName, intrinsicWidth, widths = DEFAULT_WIDTHS) {
  return { fileName, intrinsicWidth, widths: widthsForIntrinsic(intrinsicWidth, widths) };
}

/**
 * 生成清单对象（键按 URL 排序，保证 diff 稳定）。
 *
 * **紧凑格式**：`[宽, 高, [已生成的变体宽度...]]`，而不是对象数组。
 * 原因：清单会作为 JSON 被前端组件 import（进客户端 bundle），
 * 155 张图用对象格式约 51 KB，用紧凑元组约 12 KB；变体 URL 由命名约定推导（见 content-image.ts）。
 */
export function buildManifest(entries) {
  const manifest = {};
  for (const entry of [...entries].sort((a, b) => a.key.localeCompare(b.key))) {
    const widths = [...new Set(entry.variants.map((variant) => variant.w))].sort((a, b) => a - b);
    manifest[entry.key] = [entry.intrinsicWidth, entry.intrinsicHeight, widths];
  }
  return manifest;
}

/** 人类可读体积 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 汇总体积：pngBytes（原图总量） vs variantBytes（所有变体总量）。
 * 注意语义：变体是**新增**文件，用户端只会下载其中一档；`savings` 指「最坏情况取最大档也比原图小」。
 */
export function summarize({ files, pngBytes, variants }) {
  const variantBytes = variants.reduce((sum, item) => sum + (item.bytes || 0), 0);
  const perWidth = {};
  for (const item of variants) {
    perWidth[item.width] = (perWidth[item.width] || 0) + (item.bytes || 0);
  }
  const largestWidth = Math.max(0, ...variants.map((v) => v.width));
  const largestBytes = variants.filter((v) => v.width === largestWidth).reduce((s, v) => s + (v.bytes || 0), 0);
  const ratio = pngBytes > 0 ? variantBytes / pngBytes : 0;
  return {
    files,
    variants: variants.length,
    pngBytes,
    variantBytes,
    ratio,
    perWidthBytes: perWidth,
    largestWidth,
    /** 桌面端按最大档加载时相对原图的体积比（<1 即净节省） */
    largestRatio: pngBytes > 0 ? largestBytes / pngBytes : 0,
    pngHuman: formatBytes(pngBytes),
    variantHuman: formatBytes(variantBytes),
  };
}

/** 解析 CLI 参数（纯函数，便于单测） */
export function parseCliArgs(argv = [], env = {}) {
  const args = argv.filter((arg) => arg !== "--");
  const options = {
    dryRun: false,
    onlyMissing: false,
    pruneOriginals: false,
    force: false,
    quality: DEFAULT_QUALITY,
    widths: [...DEFAULT_WIDTHS],
  };
  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--only-missing") options.onlyMissing = true;
    else if (arg === "--prune-originals") options.pruneOriginals = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--quality=")) {
      const q = Number(arg.slice("--quality=".length));
      if (!Number.isInteger(q) || q < 1 || q > 100) throw new Error("--quality 需为 1-100 的整数");
      options.quality = q;
    } else if (arg.startsWith("--widths=")) {
      const widths = arg
        .slice("--widths=".length)
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      if (widths.length === 0) throw new Error("--widths 至少给一个正整数（如 --widths=640,1280）");
      options.widths = [...new Set(widths)].sort((a, b) => a - b);
    } else {
      throw new Error(`未知参数：${arg}（支持 --dry-run / --only-missing / --prune-originals / --force / --quality=N / --widths=640,1280）`);
    }
  }
  // 删除原图是破坏性操作：必须显式 --force，避免误删唯一 PNG 源
  if (options.pruneOriginals && !options.force) {
    throw new Error("--prune-originals 是破坏性操作，需同时传 --force（且确认数据库图片引用已切到 .webp）");
  }
  const envQuality = Number(env.CONTENT_IMAGE_QUALITY);
  if (!args.some((a) => a.startsWith("--quality=")) && Number.isInteger(envQuality) && envQuality > 0 && envQuality <= 100) {
    options.quality = envQuality;
  }
  return options;
}
