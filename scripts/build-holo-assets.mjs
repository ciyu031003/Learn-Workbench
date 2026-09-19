/**
 * 从 sports-cards 源目录提取「闪光卡片」素材：card.glb + 每项运动的 3 层贴图。
 * 只取卡牌本体（模型 + subject/background/lineart），不取 gallery / 构建脚本 / node_modules。
 *
 * 用法：node scripts/build-holo-assets.mjs [源目录]
 *   默认源目录 E:/Codex_output_files/sports-cards，可用 HOLO_SRC 覆盖。
 */
import { mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = process.argv[2] || process.env.HOLO_SRC || "E:/Codex_output_files/sports-cards";
const ROOT = path.resolve(import.meta.dirname, "..");

/** 源目录名 -> 我们的 SPORT_CATALOG key */
const SPORTS = {
  badminton: "badminton",
  tennis: "tennis",
  basketball: "basketball",
  football: "soccer",
  volleyball: "volleyball",
  tabletennis: "table-tennis",
  baseball: "baseball",
};

/** 目标：web 用 1152 宽，移动端 896 宽（卡片展示宽度有限，WebP 已足够清晰） */
const TARGETS = [
  { dir: "apps/web/public/holo", width: 1152, quality: 90 },
  { dir: "apps/mobile/assets/holo", width: 896, quality: 88 },
];

const LAYERS = [
  { name: "subject", quality: 90 },
  { name: "background", quality: 90 },
  { name: "lineart", quality: 92 },
];

const mb = (n) => (n / 1024 / 1024).toFixed(2) + "MB";
let total = 0;

for (const target of TARGETS) {
  const outRoot = path.join(ROOT, target.dir);
  await mkdir(outRoot, { recursive: true });
  // 模型七项运动完全一致（MD5 相同），只放一份
  await copyFile(path.join(SRC, "badminton/web/assets/card.glb"), path.join(outRoot, "card.glb"));
  for (const [srcKey, sportKey] of Object.entries(SPORTS)) {
    const outDir = path.join(outRoot, sportKey);
    await mkdir(outDir, { recursive: true });
    for (const layer of LAYERS) {
      const input = path.join(SRC, srcKey, "web/assets", layer.name + ".png");
      const dest = path.join(outDir, layer.name + ".webp");
      await sharp(input)
        .resize({ width: target.width, withoutEnlargement: true })
        .webp({ quality: layer.quality, effort: 5 })
        .toFile(dest);
      const size = (await stat(dest)).size;
      total += size;
      console.log(`${target.dir}/${sportKey}/${layer.name}.webp  ${mb(size)}`);
    }
  }
}
console.log(`[holo] 完成，全部输出合计 ${mb(total)}`);
