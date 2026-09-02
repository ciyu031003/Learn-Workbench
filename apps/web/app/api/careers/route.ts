import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

/**
 * GET /api/careers —— 学习领域列表
 * 返回系统内置域（owner_id IS NULL）+ 当前登录用户自建域，排除已归档。
 * 未登录匿名用户仅看到系统内置域。
 */
export async function GET() {
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `SELECT career_key, name, description, is_locked, sort_order,
            owner_id, kind, icon, color, phase_prefix, is_archived
     FROM careers
     WHERE is_archived = FALSE
       AND (owner_id IS NULL OR owner_id = $1)
     ORDER BY sort_order, id`,
    [uid]
  );
  return NextResponse.json({ careers: rows });
}