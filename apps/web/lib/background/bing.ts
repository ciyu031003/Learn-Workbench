import { createHash } from "node:crypto";

import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Bing 每日壁纸（P10）：抓取 → 入库（图片二进制 + 元数据），路由优先读库。
 *
 * 为什么不再写文件系统：生产容器里 assets/backgrounds/bing 没有 jpg（只有 index.json），
 * 且 python 脚本依赖 Windows psql 路径，容器内不可用。现在抓取、入库、出图全部走 Node + DB：
 *   - fetchBingWallpapers：Bing HPImageArchive（format=js&idx=0&n=days&mkt=zh-CN）
 *     → 下载 1920x1080 jpg → 解析宽高/md5 → INSERT ... ON CONFLICT (source, image_date) DO UPDATE
 *   - getBackgroundSummary / getBackgroundImage：读路径（今日优先，回退最近一张）
 *
 * 幂等：同一 image_date 重复抓取走 DO UPDATE（saved 只统计真正 INSERT 的行，重跑为 0）。
 * 容错：单日失败只记日志并跳过，不影响其它日期。
 */

export const BING_SOURCE = "bing";
export const BING_BASE_URL = "https://www.bing.com";
export const BING_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
/** Bing 壁纸分辨率：任务约定 1920x1080，够桌面/移动端 cover 展示 */
export const BING_IMAGE_RESOLUTION = "1920x1080";
export const DEFAULT_BING_DAYS = 7;
export const MAX_BING_DAYS = 8;

export interface BingApiImage {
  startdate?: string;
  urlbase?: string;
  url?: string;
  copyright?: string;
  title?: string;
}

export interface BingWallpaperFailure {
  date: string;
  reason: string;
}

export interface BingWallpaperSyncResult {
  /** 真正新增（INSERT）的日期数；重复运行应为 0 */
  saved: number;
  /** 已存在但被刷新（DO UPDATE）的日期数 */
  updated: number;
  /** 本次成功写入/刷新的日期（YYYY-MM-DD，升序） */
  dates: string[];
  /** 单日失败明细（不阻断其它日期） */
  failed: BingWallpaperFailure[];
}

/** 极简查询接口：测试可注入假 pool，不必连库。 */
export interface BingQueryable {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
}

type FetchLike = typeof globalThis.fetch;

/** Bing 只接受 n<=8（idx=0 起取最近 n 天）。 */
export function clampBingDays(days: number | undefined): number {
  const value = Number.isFinite(days) ? Math.floor(Number(days)) : DEFAULT_BING_DAYS;
  return Math.min(MAX_BING_DAYS, Math.max(1, value));
}

/** HPImageArchive 接口 URL：一次取最近 days 天（最多 8）。 */
export function buildBingArchiveUrl(days: number = DEFAULT_BING_DAYS): string {
  const count = clampBingDays(days);
  return BING_BASE_URL + "/HPImageArchive.aspx?format=js&idx=0&n=" + count + "&mkt=zh-CN";
}

/** 把 Bing 的 startdate（20261031）转成 image_date（2026-10-31）。 */
export function bingStartDateToIso(startdate: string | undefined | null): string | null {
  const value = String(startdate ?? "").trim();
  if (!/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = value.slice(0, 4) + "-" + value.slice(4, 6) + "-" + value.slice(6, 8);
  const parsed = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    return null;
  }
  return iso;
}

/** 取 1920x1080 的下载地址：优先 urlbase + 分辨率，退化到 url 字段。 */
export function resolveBingImageUrl(image: BingApiImage): string | null {
  const urlbase = String(image?.urlbase ?? "").trim();
  if (urlbase) return BING_BASE_URL + urlbase + "_" + BING_IMAGE_RESOLUTION + ".jpg";
  const url = String(image?.url ?? "").trim();
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : BING_BASE_URL + url;
}

/** 从 JPEG 字节里解析宽高（SOFn 段）；失败返回 null。 */
export function parseJpegSize(buffer: Buffer): { width: number; height: number } | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      if (offset + 9 > buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      if (!width || !height) return null;
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

export function md5Hex(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("hex");
}

const UPSERT_SQL =
  "INSERT INTO background_images " +
  "(source, image_date, file_name, remote_url, local_path, width, height, md5_hash, copyright, image_data, mime, updated_at) " +
  "VALUES ($1, $2::date, $3, $4, NULL, $5, $6, $7, $8, $9, $10, now()) " +
  "ON CONFLICT (source, image_date) DO UPDATE SET " +
  "file_name = EXCLUDED.file_name, remote_url = EXCLUDED.remote_url, " +
  "width = EXCLUDED.width, height = EXCLUDED.height, md5_hash = EXCLUDED.md5_hash, " +
  "copyright = EXCLUDED.copyright, image_data = EXCLUDED.image_data, " +
  "mime = EXCLUDED.mime, updated_at = now() " +
  "RETURNING id, (xmax = 0) AS inserted";

async function downloadImage(fetchImpl: FetchLike, url: string): Promise<{ buffer: Buffer; mime: string }> {
  const response = await fetchImpl(url, {
    headers: { "user-agent": BING_USER_AGENT, accept: "image/jpeg,image/*" },
  });
  if (!response.ok) throw new Error("图片下载 HTTP " + response.status);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) throw new Error("图片体积异常（" + buffer.length + " 字节）");
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("返回内容不是 JPEG");
  const contentType = response.headers.get("content-type") ?? "";
  const mime = contentType.split(";")[0]?.trim() || "image/jpeg";
  return { buffer, mime };
}

/**
 * 抓取最近 days 天的 Bing 壁纸并写库（图片二进制入库）。
 * 返回 { saved, updated, dates, failed }；任一单日失败只跳过该日。
 */
export async function fetchBingWallpapers(
  options: { days?: number; fetchImpl?: FetchLike; queryable?: BingQueryable } = {},
): Promise<BingWallpaperSyncResult> {
  const days = clampBingDays(options.days);
  const fetchImpl = options.fetchImpl ?? fetch;
  const queryable = options.queryable ?? (pgPool as unknown as BingQueryable);
  const result: BingWallpaperSyncResult = { saved: 0, updated: 0, dates: [], failed: [] };

  let images: BingApiImage[] = [];
  try {
    const response = await fetchImpl(buildBingArchiveUrl(days), {
      headers: { "user-agent": BING_USER_AGENT, accept: "application/json" },
    });
    if (!response.ok) throw new Error("Bing 接口 HTTP " + response.status);
    const data = (await response.json()) as { images?: BingApiImage[] };
    images = Array.isArray(data.images) ? data.images.slice(0, days) : [];
    if (images.length === 0) throw new Error("Bing 接口未返回 images");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[bing] 拉取壁纸列表失败", error);
    result.failed.push({ date: "*", reason: message });
    return result;
  }

  const seen = new Set<string>();
  for (const image of images) {
    const date = bingStartDateToIso(image.startdate);
    if (!date) {
      result.failed.push({ date: String(image.startdate ?? "?"), reason: "startdate 无效" });
      continue;
    }
    if (seen.has(date)) continue;
    seen.add(date);
    try {
      const imageUrl = resolveBingImageUrl(image);
      if (!imageUrl) throw new Error("缺少 url/urlbase");
      const { buffer, mime } = await downloadImage(fetchImpl, imageUrl);
      const size = parseJpegSize(buffer);
      const copyright = String(image.copyright ?? "").trim() || null;
      const { rows } = await queryable.query(UPSERT_SQL, [
        BING_SOURCE,
        date,
        date + ".jpg",
        imageUrl,
        size?.width ?? null,
        size?.height ?? null,
        md5Hex(buffer),
        copyright,
        buffer,
        mime,
      ]);
      const inserted = Boolean((rows[0] as { inserted?: boolean } | undefined)?.inserted);
      if (inserted) result.saved += 1;
      else result.updated += 1;
      result.dates.push(date);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("[bing] 单日壁纸抓取失败，已跳过", { date, reason: message });
      result.failed.push({ date, reason: message });
    }
  }

  result.dates.sort();
  logger.info("[bing] 壁纸同步完成", {
    days,
    saved: result.saved,
    updated: result.updated,
    dates: result.dates,
    failed: result.failed.length,
  });
  return result;
}

/* ------------------------------------------------------------------ */
/* 读路径：路由优先读库，库不可用时由路由回退 assets 文件               */
/* ------------------------------------------------------------------ */

export interface BackgroundSummary {
  date: string;
  remoteUrl: string | null;
  copyright: string | null;
  width: number | null;
  height: number | null;
  mime: string;
}

interface BackgroundSummaryRow {
  image_date: string;
  remote_url: string | null;
  copyright: string | null;
  width: number | null;
  height: number | null;
  mime: string | null;
}

const SUMMARY_SQL =
  "SELECT image_date::text AS image_date, remote_url, copyright, width, height, mime " +
  "FROM background_images " +
  "WHERE source = $1 AND image_data IS NOT NULL " +
  "ORDER BY (image_date = $2::date) DESC, image_date DESC " +
  "LIMIT 1";

/** 今日优先；今日没有（时区/抓取延迟）就取最近一张可展示的图。 */
export async function getBackgroundSummary(preferredDate: string): Promise<BackgroundSummary | null> {
  const { rows } = await pgPool.query<BackgroundSummaryRow>(SUMMARY_SQL, [BING_SOURCE, preferredDate]);
  const row = rows[0];
  if (!row) return null;
  return {
    date: row.image_date,
    remoteUrl: row.remote_url,
    copyright: row.copyright,
    width: row.width,
    height: row.height,
    mime: row.mime || "image/jpeg",
  };
}

export interface BackgroundImageData {
  data: Buffer;
  mime: string;
  md5: string | null;
  updatedAt: Date;
}

const IMAGE_SQL =
  "SELECT image_data, mime, md5_hash, updated_at FROM background_images " +
  "WHERE source = $1 AND image_date = $2::date AND image_data IS NOT NULL LIMIT 1";

export async function getBackgroundImage(date: string): Promise<BackgroundImageData | null> {
  const { rows } = await pgPool.query<{
    image_data: Buffer | null;
    mime: string | null;
    md5_hash: string | null;
    updated_at: Date | null;
  }>(IMAGE_SQL, [BING_SOURCE, date]);
  const row = rows[0];
  if (!row || !row.image_data) return null;
  return {
    data: row.image_data,
    mime: row.mime || "image/jpeg",
    md5: row.md5_hash,
    updatedAt: row.updated_at ?? new Date(0),
  };
}
