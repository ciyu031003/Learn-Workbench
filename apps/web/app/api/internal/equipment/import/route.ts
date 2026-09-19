import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { EQUIPMENT_CATEGORIES } from "../../../equipment/route";

const MAX_ITEMS = 500;

export interface EquipmentImportItem {
  category: string;
  brand: string;
  model: string;
  path: string;
  width?: number;
  height?: number;
  bytes?: number;
  sourceUrl?: string;
  sourceSite?: string;
  crawledAt?: string;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** 桶内相对路径：<category>/<file>.webp */
export function isSafeEquipmentPath(value: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9._-]+\.webp$/.test(value) && !value.includes("..");
}

/**
 * POST /api/internal/equipment/import —— 批量导入装备图库（图片已由脚本 scp 进桶）
 * 鉴权：x-cron-secret == CRON_SECRET（与 cron 任务同款）
 * body: { items: EquipmentImportItem[] }
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "未授权" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { items?: unknown } | null;
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "items 不能为空" }, { status: 400 });
  if (items.length > MAX_ITEMS) return NextResponse.json({ error: "单次最多 " + MAX_ITEMS + " 条" }, { status: 400 });

  let imported = 0;
  const skipped: string[] = [];
  for (const raw of items as EquipmentImportItem[]) {
    const category = text(raw?.category, 40);
    const brand = text(raw?.brand, 40);
    const model = text(raw?.model, 120);
    const imagePath = text(raw?.path, 200);
    if (
      !(EQUIPMENT_CATEGORIES as readonly string[]).includes(category) ||
      !brand ||
      !model ||
      !isSafeEquipmentPath(imagePath)
    ) {
      skipped.push(brand + " " + model);
      continue;
    }
    await pgPool.query(
      `INSERT INTO equipment_items
         (category, brand, model, image_path, width, height, bytes, source_url, source_site, crawled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (category, brand, model) DO UPDATE SET
         image_path = EXCLUDED.image_path,
         width = EXCLUDED.width, height = EXCLUDED.height, bytes = EXCLUDED.bytes,
         source_url = EXCLUDED.source_url, source_site = EXCLUDED.source_site,
         crawled_at = EXCLUDED.crawled_at, is_listed = true, updated_at = now()`,
      [
        category,
        brand,
        model,
        imagePath,
        Number(raw?.width) || null,
        Number(raw?.height) || null,
        Number(raw?.bytes) || null,
        text(raw?.sourceUrl, 500) || null,
        text(raw?.sourceSite, 120) || null,
        raw?.crawledAt ? new Date(raw.crawledAt).toISOString() : null,
      ]
    );
    imported += 1;
  }

  return NextResponse.json({ imported, skipped });
}
