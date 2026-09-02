import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

/** 校验候选 key：系统内置域 + 当前用户自建域（排除已归档） */
async function isValidCareerKey(key: string, uid: string): Promise<boolean> {
  const { rows } = await pgPool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM careers
       WHERE career_key = $1 AND is_archived = FALSE
         AND (owner_id IS NULL OR owner_id = $2)
     ) AS exists`,
    [key, uid]
  );
  return rows[0]?.exists ?? false;
}

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ career: "ict", set: false });
  const { rows } = await pgPool.query<{ value: unknown }>(
    `SELECT value FROM settings WHERE user_id = $1 AND key = 'career'`,
    [uid]
  );
  return NextResponse.json({ career: rows[0]?.value ?? "ict", set: rows.length > 0 });
}

export async function PUT(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const career = String(body?.career ?? "ict");
  if (!(await isValidCareerKey(career, uid))) {
    return NextResponse.json({ error: "职业无效" }, { status: 400 });
  }
  await pgPool.query(
    `INSERT INTO settings (user_id, key, value) VALUES ($1, 'career', $2::jsonb)
     ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [uid, JSON.stringify(career)]
  );
  return NextResponse.json({ ok: true, career });
}
