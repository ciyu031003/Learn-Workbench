import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

const VALID = new Set([
  "ict", "frontend", "java-backend", "data-analysis", "ai-engineer", "cyber-security",
]);

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ career: "ict" });
  const { rows } = await pgPool.query<{ value: unknown }>(
    `SELECT value FROM settings WHERE user_id = $1 AND key = 'career'`,
    [uid]
  );
  return NextResponse.json({ career: rows[0]?.value ?? "ict" });
}

export async function PUT(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const career = String(body?.career ?? "ict");
  if (!VALID.has(career)) return NextResponse.json({ error: "职业无效" }, { status: 400 });
  await pgPool.query(
    `INSERT INTO settings (user_id, key, value) VALUES ($1, 'career', $2::jsonb)
     ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [uid, JSON.stringify(career)]
  );
  return NextResponse.json({ ok: true, career });
}
