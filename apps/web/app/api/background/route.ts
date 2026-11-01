import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { todayISO } from "@learn-workbench/shared";

import { getBackgroundSummary } from "@/lib/background/bing";
import { logger } from "@/lib/logger";

/**
 * GET /api/background —— 专注计时「Bing 壁纸」的当日展示信息。
 *
 * P10 起改为「DB 优先」：background_images 里存了图片二进制与元数据，
 * 今日有就用今日、没有就用最近一张（Bing 日期可能比本地时区晚一天）。
 * 数据库不可用 / 尚无入库记录时，回退旧的 assets/backgrounds/bing/index.json（保留兼容）。
 */
export interface ManifestEntry {
  file: string;
  remote_url: string;
  copyright: string;
  width: number | null;
  height: number | null;
  md5: string;
}

function findBgDir(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "assets", "backgrounds", "bing");
    if (fs.existsSync(path.join(candidate, "index.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readFileFallback(today: string) {
  const dir = findBgDir();
  if (!dir) return null;
  let manifest: Record<string, ManifestEntry> = {};
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf-8"));
  } catch {
    manifest = {};
  }
  const dates = Object.keys(manifest).sort();
  let pick = dates.find((d) => d === today) ?? null;
  if (!pick && dates.length > 0) {
    const past = dates.filter((d) => d < today);
    pick = past.length > 0 ? past[past.length - 1] : dates[dates.length - 1];
  }
  if (!pick) return null;
  const entry = manifest[pick];
  return {
    date: pick,
    file: entry.file,
    remoteUrl: entry.remote_url,
    copyright: entry.copyright,
    width: entry.width,
    height: entry.height,
    exists: fs.existsSync(path.join(dir, entry.file)),
    source: "file" as const,
  };
}

export async function GET() {
  const today = todayISO();

  try {
    const summary = await getBackgroundSummary(today);
    if (summary) {
      return NextResponse.json({
        date: summary.date,
        file: summary.date + ".jpg",
        remoteUrl: summary.remoteUrl,
        copyright: summary.copyright,
        width: summary.width,
        height: summary.height,
        exists: true,
        mime: summary.mime,
        source: "db",
      });
    }
  } catch (error) {
    logger.warn("[background] 读库失败，回退 assets 清单", error);
  }

  const fallback = readFileFallback(today);
  if (!fallback) return NextResponse.json({ date: today, file: null, exists: false, source: "none" });
  return NextResponse.json(fallback);
}
