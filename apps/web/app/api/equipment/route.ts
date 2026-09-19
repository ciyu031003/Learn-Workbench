import { NextResponse } from "next/server";
import { EQUIPMENT_CATEGORIES as SHARED_EQUIPMENT_CATEGORIES } from "@learn-workbench/shared";
import { pgPool } from "@/lib/db";

/** 装备图库的分类白名单（唯一事实源在 shared，爬虫与双端选择器共用） */
export const EQUIPMENT_CATEGORIES = SHARED_EQUIPMENT_CATEGORIES.map((c) => c.key);

export interface EquipmentRow {
  id: number;
  category: string;
  brand: string;
  model: string;
  imagePath: string;
  width: number | null;
  height: number | null;
}

/** 桶内相对路径 → 站内地址（nginx /uploads/ 同款直出，只是换到 /equipment/） */
export function equipmentImageUrl(imagePath: string): string {
  return "/equipment/" + imagePath.split("/").map(encodeURIComponent).join("/");
}

/**
 * GET /api/equipment —— 装备图库（公开只读）
 * 查询：category / q（型号或品牌模糊）/ brand / limit（默认 40，上限 100）
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category")?.trim() ?? "";
  const brand = url.searchParams.get("brand")?.trim() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.round(limitRaw)) : 40;

  const conditions = ["is_listed = true"];
  const params: unknown[] = [];
  if (category) {
    params.push(category);
    conditions.push("category = $" + params.length);
  }
  if (brand) {
    params.push(brand);
    conditions.push("brand = $" + params.length);
  }
  if (q) {
    params.push("%" + q + "%");
    conditions.push("(model ILIKE $" + params.length + " OR brand ILIKE $" + params.length + ")");
  }
  params.push(limit);

  const { rows } = await pgPool.query<EquipmentRow>(
    `SELECT id, category, brand, model, image_path AS "imagePath", width, height
       FROM equipment_items
      WHERE ${conditions.join(" AND ")}
      ORDER BY brand, model
      LIMIT $${params.length}`,
    params
  );

  return NextResponse.json(
    {
      items: rows.map((row) => ({
        id: row.id,
        category: row.category,
        brand: row.brand,
        model: row.model,
        imageUrl: equipmentImageUrl(row.imagePath),
        width: row.width,
        height: row.height,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=600" } }
  );
}
