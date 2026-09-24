import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { addApplication, deleteApplication, getApplicationByJob } from "@/lib/job-applications";

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
  // 收藏与「我的求职」是同一份意图：收藏即进入求职看板（阶段=收藏）。
  // 真机反馈：在招花点爱心后「我的求职」里什么都看不到 —— 因为旧实现只写 job_favorites，
  // 而 /api/jobs/applications 读的是 job_applications，两张表never同步。
  if (existing.length > 0) {
    await pgPool.query("DELETE FROM job_favorites WHERE user_id = $1 AND job_id = $2", [userId, num]);
    // 仍停在「收藏」阶段 → 一起移除；已推进到后续阶段（投递/面试…）→ 保留，不误删进度
    const app = await getApplicationByJob(userId, num);
    if (app && app.stage === "favorite") await deleteApplication(userId, app.id);
    return NextResponse.json({ favorited: false });
  }
  await pgPool.query("INSERT INTO job_favorites (user_id, job_id) VALUES ($1, $2)", [userId, num]);
  // 已有求职记录时不覆盖其阶段（addApplication 是 upsert 会改写 stage）
  const tracked = await getApplicationByJob(userId, num);
  if (!tracked) await addApplication(userId, num, "favorite");
  return NextResponse.json({ favorited: true });
}
