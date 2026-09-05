import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { SPORT_CATALOG, type SportItem } from "@learn-workbench/shared";

/**
 * 运动项目目录：优先读库（迁移 030 sport_items），库不可用/为空时回退代码内置目录。
 * 纯静态目录，无需鉴权。
 */
export async function GET() {
  try {
    const { rows } = await pgPool.query<{
      key: string;
      name: string;
      type: SportItem["type"];
      met: string;
      default_minutes: number;
      featured: boolean;
    }>(
      `SELECT key, name, type, met, default_minutes, featured
       FROM sport_items WHERE enabled = true ORDER BY sort ASC`
    );
    if (rows.length > 0) {
      return NextResponse.json({
        items: rows.map((r) => ({
          key: r.key,
          name: r.name,
          type: r.type,
          met: Number(r.met),
          defaultMinutes: r.default_minutes,
          featured: r.featured,
        })),
      });
    }
  } catch {
    // 库不可用 → 代码内置目录兜底
  }
  return NextResponse.json({ items: SPORT_CATALOG });
}
