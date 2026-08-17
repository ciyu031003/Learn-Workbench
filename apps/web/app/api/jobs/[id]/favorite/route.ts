import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "无效职位 ID" }, { status: 400 });
  }
  const { rows } = await pgPool.query("SELECT 1 FROM job_postings WHERE id = $1", [num]);
  if (!rows[0]) return NextResponse.json({ error: "职位不存在" }, { status: 404 });

  const { rows: existing } = await pgPool.query(
    "SELECT 1 FROM job_favorites WHERE user_id = $1 AND job_id = $2",
    [userId, num]
  );
  if (existing.length > 0) {
    await pgPool.query("DELETE FROM job_favorites WHERE user_id = $1 AND job_id = $2", [userId, num]);
    return NextResponse.json({ favorited: false });
  }
  await pgPool.query("INSERT INTO job_favorites (user_id, job_id) VALUES ($1, $2)", [userId, num]);
  return NextResponse.json({ favorited: true });
}
