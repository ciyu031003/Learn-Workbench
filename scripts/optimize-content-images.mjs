#!/usr/bin/env node
/**
 * S3-5 内容图优化管线
 *
 * 把 `apps/web/public/content-images/*.png` 转成 2 档 WebP（默认 640w / 1280w），
 * 并生成 `apps/web/lib/content-image-manifest.json` 供 `components/exam/question-image.tsx` 查表。
 *
 * 用法：
 *   node scripts/optimize-content-images.mjs                     # 生成变体 + 清单
 *   node scripts/optimize-content-images.mjs --dry-run           # 只编码到内存，输出预计体积（不落盘）
 *   node scripts/optimize-content-images.mjs --only-missing      # 已存在的变体跳过（增量）
 *   node scripts/optimize-content-images.mjs --force             # 覆盖已有变体
 *   node scripts/optimize-content-images.mjs --widths=480,960,1440 --quality=88
 *   node scripts/optimize-content-images.mjs --prune-originals --force  # 删原图（需 DB 已切 webp）
 *
 * 退出码：0 = 成功；1 = 参数错误或存在处理失败（失败文件会逐条打印，不静默）。
 */
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  buildManifest,
  formatBytes,
  manifestKey,
  parseCliArgs,
  planFile,
  summarize,
  variantFileName,
} from "./lib/image-pipeline.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_DIR = path.join(ROOT, "apps/web/public/content-images");
const MANIFEST_PATH = path.join(ROOT, "apps/web/lib/content-image-manifest.json");

const USAGE = `内容图优化管线（S3-5）

  node scripts/optimize-content-images.mjs [选项]

选项：
  --dry-run            只编码到内存并输出预计体积，不写任何文件
  --only-missing       已存在的变体不再重编码（清单仍会重建）
  --force              覆盖已有变体（--prune-originals 时必须显式带上）
  --prune-originals    删除已生成全部变体的 PNG（破坏性，需 --force）
  --quality=N          WebP 质量 1-100（默认 84）
  --widths=640,1280    目标宽度（默认 640,1280）
  -h, --help           显示帮助`;

let options;
try {
  options = parseCliArgs(process.argv.slice(2), process.env);
} catch (error) {
  console.error(`[image-pipeline] 参数错误：${error.message}`);
  process.exit(1);
}
if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const started = Date.now();
  let entries;
  try {
    entries = await readdir(INPUT_DIR, { withFileTypes: true });
  } catch (error) {
    console.error(`[image-pipeline] 读不到目录 ${INPUT_DIR}：${error.message}`);
    process.exit(1);
  }

  const pngFiles = entries
    .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (pngFiles.length === 0) {
    console.error(`[image-pipeline] ${INPUT_DIR} 下没有 PNG，退出`);
    process.exit(1);
  }

  const manifestEntries = [];
  const variantStats = [];
  const failures = [];
  let pngBytes = 0;
  let written = 0;
  let skipped = 0;
  let pruned = 0;

  for (const [index, fileName] of pngFiles.entries()) {
    const sourcePath = path.join(INPUT_DIR, fileName);
    try {
      const sourceSize = (await stat(sourcePath)).size;
      pngBytes += sourceSize;

      const metadata = await sharp(sourcePath).metadata();
      if (!metadata.width || !metadata.height) throw new Error("读不到图片尺寸");
      const plan = planFile(fileName, metadata.width, options.widths);
      const variants = [];

      for (const width of plan.widths) {
        const outName = variantFileName(fileName, width);
        const outPath = path.join(INPUT_DIR, outName);
        const existed = await stat(outPath).then(() => true).catch(() => false);

        // 已存在且不要求覆盖：非 dry-run 直接复用；dry-run 默认重新编码以给出真实体积（--only-missing 时复用）
        if (existed && !options.force && (!options.dryRun || options.onlyMissing)) {
          // 已存在且不要求覆盖：直接复用（仍计入清单与体积统计）
          const size = (await stat(outPath)).size;
          variantStats.push({ width, bytes: size });
          variants.push({ w: width, src: manifestKey(outName) });
          skipped += 1;
          continue;
        }

        const pipeline = sharp(sourcePath)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: options.quality, effort: 5 });

        if (options.dryRun) {
          const buffer = await pipeline.toBuffer({ resolveWithObject: true });
          variantStats.push({ width: buffer.info.width, bytes: buffer.data.length });
          variants.push({ w: buffer.info.width, src: manifestKey(outName) });
        } else {
          const info = await pipeline.toFile(outPath);
          variantStats.push({ width: info.width, bytes: info.size });
          variants.push({ w: info.width, src: manifestKey(outName) });
          written += 1;
        }
      }

      manifestEntries.push({
        key: manifestKey(fileName),
        intrinsicWidth: metadata.width,
        intrinsicHeight: metadata.height,
        variants,
      });

      if (!options.dryRun && options.pruneOriginals && plan.widths.every((width) => variants.some((v) => v.w === width))) {
        const { unlink } = await import("node:fs/promises");
        await unlink(sourcePath);
        pruned += 1;
      }
    } catch (error) {
      failures.push({ fileName, message: error.message });
      console.error(`[image-pipeline] 失败 ${fileName}：${error.message}`);
    }

    if ((index + 1) % 20 === 0 || index === pngFiles.length - 1) {
      console.log(`[image-pipeline] 进度 ${index + 1}/${pngFiles.length}`);
    }
    // 让出事件循环，避免长任务占满 CPU（脚本可 Ctrl-C）
    if ((index + 1) % 10 === 0) await sleep(0);
  }

  const manifest = buildManifest(manifestEntries);
  const summary = summarize({ files: manifestEntries.length, pngBytes, variants: variantStats });

  if (!options.dryRun) {
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  }

  const report = {
    mode: options.dryRun ? "dry-run" : "write",
    quality: options.quality,
    widths: options.widths,
    files: summary.files,
    variants: summary.variants,
    png: summary.pngHuman,
    pngBytes: pngBytes,
    variantsHuman: summary.variantHuman,
    variantBytes: summary.variantBytes,
    ratio: Number(summary.ratio.toFixed(3)),
    largestRatio: Number(summary.largestRatio.toFixed(3)),
    perWidthKB: Object.fromEntries(Object.entries(summary.perWidthBytes).map(([w, b]) => [w, Math.round(b / 1024)])),
    written,
    skipped,
    pruned,
    failures: failures.length,
    manifest: options.dryRun ? "(dry-run 未写入)" : path.relative(ROOT, MANIFEST_PATH),
    seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
  };

  console.log(`[image-pipeline] 原图 ${summary.files} 张 / ${formatBytes(pngBytes)} → 变体 ${summary.variants} 个 / ${formatBytes(summary.variantBytes)}`);
  console.log(`[image-pipeline] 最大档占原图 ${(summary.largestRatio * 100).toFixed(1)}%；写 ${written} / 跳过 ${skipped} / 删原图 ${pruned}`);
  console.log(`[image-pipeline] summary ${JSON.stringify(report)}`);

  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[image-pipeline] 未捕获异常：${error?.stack || error}`);
  process.exitCode = 1;
});
