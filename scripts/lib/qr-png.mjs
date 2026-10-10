/**
 * 下载二维码生成（零新增依赖）。
 *
 * 背景：此前每一步发布都用 `.local/qrgen/gen-v1XX.mjs` 手工生成（依赖本地临时装的 `qrcode`），
 * 而 `.local/` 是 gitignore 的 —— 换台机器 / 新会话就得重新临时装依赖，"扫码还能下到上一版"
 * 这类事故正是这么来的。
 *
 * 现在的实现只用仓库**已声明**的依赖：
 *   - `toqr`（Expo 工具链里已有的极小 QR 编码器）→ 输出 n×n 的 0/1 矩阵（每模块 1 字节）
 *   - `pngjs`（根 package.json 的 dependencies，原本用于二维码解码校验）
 * 并用 `scripts/lib/qr-png.test.mjs` 做**真实解码回环**（jsQR）——生成错了测试会红。
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

function loadEncoder() {
  try {
    const mod = require("toqr");
    return typeof mod?.toQR === "function" ? mod.toQR : null;
  } catch {
    return null;
  }
}

/** QR 纠错等级（toqr 的枚举顺序：M=0 / L=1 / H=2 / Q=3），默认 M（与历史二维码一致） */
export const QR_EC_M = 0;

/** 静区模块数（QR 规范要求 ≥4；下载页里二维码放在白底卡片上，取 4 即可） */
export const QR_QUIET_MODULES = 4;

/**
 * 把文本渲染成正方形 PNG（默认 640×640，与历史产物一致）。
 *
 * @param {string} text 二维码内容（下载地址）
 * @param {{ sizePx?: number, quietModules?: number, ec?: number }} [options]
 * @returns {Buffer} PNG 字节
 */
export function renderQrPng(text, options = {}) {
  const content = String(text ?? "").trim();
  if (!content) throw new Error("renderQrPng: 内容为空");

  const toQR = loadEncoder();
  if (!toQR) {
    throw new Error(
      "renderQrPng: 找不到 QR 编码器 toqr（通常随 Expo 工具链安装）。" +
        "请在仓库根执行 pnpm install，或用 --skip-qr 复用上一次的二维码。"
    );
  }

  const sizePx = Number.isFinite(options.sizePx) ? options.sizePx : 640;
  const quietModules = Number.isFinite(options.quietModules) ? options.quietModules : QR_QUIET_MODULES;
  const ec = Number.isFinite(options.ec) ? options.ec : QR_EC_M;

  const bytes = toQR(content, ec);
  const modules = Math.round(Math.sqrt(bytes.length));
  if (modules * modules !== bytes.length) {
    throw new Error(`renderQrPng: 未知的矩阵形状（${bytes.length} 字节，期望 n×n）`);
  }

  const scale = Math.max(1, Math.floor(sizePx / (modules + quietModules * 2)));
  const dim = sizePx;
  const pad = Math.floor((dim - scale * modules) / 2);

  const png = new PNG({ width: dim, height: dim });
  for (let y = 0; y < dim; y += 1) {
    for (let x = 0; x < dim; x += 1) {
      const idx = (dim * y + x) << 2;
      let dark = false;
      const mx = Math.floor((x - pad) / scale);
      const my = Math.floor((y - pad) / scale);
      if (mx >= 0 && mx < modules && my >= 0 && my < modules) {
        dark = bytes[my * modules + mx] === 1;
      }
      const v = dark ? 0 : 255;
      png.data[idx] = v;
      png.data[idx + 1] = v;
      png.data[idx + 2] = v;
      png.data[idx + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

/** 解码 PNG（校验用；jsqr 是根 package.json 的 dependencies） */
export function decodeQrPng(buffer) {
  const jsQR = require("jsqr");
  const png = PNG.sync.read(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result ? result.data : null;
}
