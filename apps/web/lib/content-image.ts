/**
 * 内容图（408 题目配图）变体解析（S3-5）。
 *
 * 清单由 `scripts/optimize-content-images.mjs` 生成，紧凑格式：
 *   { "/content-images/foo.png": [宽, 高, [640, 1280]] }
 *
 * 变体文件名由**命名约定**推导（脚本侧 `variantFileName` 单一实现）：
 *   `foo.png` + 640 → `foo@640w.webp`
 * 这样清单只需要尺寸与已生成档位，体积比"逐条写 src"小 60%+（会进客户端 bundle）。
 */
import rawManifest from "./content-image-manifest.json";

type CompactEntry = readonly [number, number, readonly number[]];
type CompactManifest = Record<string, CompactEntry>;

const MANIFEST = rawManifest as unknown as CompactManifest;

export const CONTENT_IMAGE_PREFIX = "/content-images/";

export interface ContentImageMeta {
  /** 原图固有宽度（px） */
  width: number;
  /** 原图固有高度（px） */
  height: number;
  /** 已生成的 WebP 变体宽度，升序 */
  widths: number[];
}

/** 是否属于本管线管理的内容图（外部 URL / COS 图片不受影响） */
export function isContentImageUrl(src: string): boolean {
  return typeof src === "string" && src.startsWith(CONTENT_IMAGE_PREFIX) && !src.includes("@");
}

/** 去掉 query/hash，得到清单键（数据库里存的是干净路径，这里做防御） */
export function toManifestKey(src: string): string {
  return src.split("?")[0].split("#")[0];
}

/** 查清单；未收录（新图还没跑管线）返回 null，调用方回退到原图 */
export function contentImageMeta(src: string): ContentImageMeta | null {
  if (!isContentImageUrl(src)) return null;
  const entry = MANIFEST[toManifestKey(src)];
  if (!entry || entry.length < 3) return null;
  const [width, height, widths] = entry;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Array.isArray(widths) || widths.length === 0) return null;
  return { width, height, widths: [...widths] };
}

/** 生成某个宽度的 WebP 变体 URL（与脚本侧 variantFileName 约定一致） */
export function contentImageVariantUrl(src: string, width: number): string {
  if (!Number.isInteger(width) || width <= 0) throw new Error("contentImageVariantUrl: width 必须是正整数");
  const clean = toManifestKey(src);
  return clean.replace(/\.png$/i, `@${width}w.webp`);
}

/** 生成 srcSet；无清单记录返回 undefined（调用方不渲染 <source>） */
export function contentImageSrcSet(src: string): string | undefined {
  const meta = contentImageMeta(src);
  if (!meta) return undefined;
  return meta.widths.map((width) => `${contentImageVariantUrl(src, width)} ${width}w`).join(", ");
}
