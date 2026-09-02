import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export async function GET() {
  const uid = await currentUserId();
  let career = "ict";
  if (uid) {
    const { rows } = await pgPool.query<{ value: unknown }>(
      `SELECT value FROM settings WHERE user_id = $1 AND key = $2`,
      [uid, "career"]
    );
    if (rows[0]?.value) career = String(rows[0].value);
  }
  // 仅返回系统内置阶段 + 当前用户自定义阶段，防止跨账号串扰
  const { rows } = await pgPool.query<{ id: number; phase_key: string; title: string; track: string }>(
    `SELECT id, phase_key, title, track FROM content_phases
     WHERE career_key = $1 AND (is_custom = FALSE OR owner_id = $2)
     ORDER BY track, sort_order, id`,
    [career, uid]
  );
  return NextResponse.json({ career, phases: rows });
}
