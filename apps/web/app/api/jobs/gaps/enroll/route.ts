import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { enrollGapsToTasks } from "@/lib/skills";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const gaps = Array.isArray(body?.gaps) ? body.gaps : [];
  if (gaps.length === 0) return NextResponse.json({ error: "没有可加入的缺口" }, { status: 400 });
  try {
    const created = await enrollGapsToTasks(
      userId,
      gaps.map((g: { skill?: string; topicId?: number | null; hours?: number }) => ({
        skill: String(g.skill ?? "技能"),
        topicId: g.topicId ? Number(g.topicId) : null,
        hours: Number(g.hours) || 8,
      }))
    );
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    logger.error("gaps enroll error", e);
    return NextResponse.json({ error: "加入学习路线失败" }, { status: 500 });
  }
}
