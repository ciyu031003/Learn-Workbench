// 一次性脚本：用「苦旅学习APP图标设计.png」重新生成 App 图标资源
// 用法: cd apps/mobile && node scripts/gen-icons.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(__dirname, '..');
const SRC = 'D:/Desktop/苦旅学习APP图标设计.png';
const ASSETS = path.join(MOBILE, 'assets', 'images');
const RES = path.join(MOBILE, 'android', 'app', 'src', 'main', 'res');

// 1) 读取源图并居中裁成正方形
const square = sharp(SRC).resize(1638, 1638, { fit: 'cover', position: 'centre' });

// 2) 源资源（供后续 expo prebuild / web favicon 使用）
await square.clone().resize(1024, 1024).png().toFile(path.join(ASSETS, 'icon.png'));
await square.clone().resize(48, 48).png().toFile(path.join(ASSETS, 'favicon.png'));
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#FFFFFF' } })
  .png().toFile(path.join(ASSETS, 'android-icon-background.png'));
await square.clone().resize(512, 512).png().toFile(path.join(ASSETS, 'android-icon-foreground.png'));
await makeMonochrome(square.clone(), 432, path.join(ASSETS, 'android-icon-monochrome.png'));

// 3) Android 原生资源（实际打进 APK 的图标）
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const [d, size] of Object.entries(legacy)) {
  const dir = path.join(RES, `mipmap-${d}`);
  await square.clone().resize(size, size).webp({ quality: 100, lossless: true })
    .toFile(path.join(dir, 'ic_launcher.webp'));
  await square.clone().resize(size, size).webp({ quality: 100, lossless: true })
    .toFile(path.join(dir, 'ic_launcher_round.webp'));
}

for (const [d, size] of Object.entries(adaptive)) {
  const dir = path.join(RES, `mipmap-${d}`);
  await sharp({ create: { width: size, height: size, channels: 4, background: '#FFFFFF' } })
    .webp({ lossless: true }).toFile(path.join(dir, 'ic_launcher_background.webp'));
  await square.clone().resize(size, size).webp({ quality: 100, lossless: true })
    .toFile(path.join(dir, 'ic_launcher_foreground.webp'));
  await makeMonochrome(square.clone(), size, path.join(dir, 'ic_launcher_monochrome.webp'));
}

async function makeMonochrome(srcPipeline, size, out) {
  const { data, info } = await srcPipeline.resize(size, size).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const outBuf = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const avg = (r + g + b) / 3;
    // 白色/近白背景 → 透明；有色内容 → 白色 + alpha（供 Android 13+ 主题图标染色）
    const alpha = Math.max(0, Math.min(255, Math.round(((250 - avg) / 40) * 255)));
    outBuf[i] = 255; outBuf[i + 1] = 255; outBuf[i + 2] = 255;
    outBuf[i + 3] = a < 128 ? 0 : alpha;
  }
  await sharp(outBuf, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ lossless: true }).toFile(out);
}

console.log('icons generated OK');
