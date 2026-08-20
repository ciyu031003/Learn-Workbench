import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { backfillUserSkillsFromResume, listUserSkills, setUserSkill, removeUserSkill } from "@/lib/skills";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const skills = await listUserSkills(userId);
    return NextResponse.json({ skills });
  } catch (e) {
    console.error("profile skills error", e);
    return NextResponse.json({ error: "技能画像加载失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const action = body?.action === "resume" ? "resume" : "set";
  try {
    if (action === "resume") {
      const added = await backfillUserSkillsFromResume(userId);
      return NextResponse.json({ ok: true, added });
    }
    const skillId = Number(body?.skillId);
    const level = Math.max(0, Math.min(5, Number(body?.level) || 2));
    if (!Number.isInteger(skillId) || skillId <= 0) {
      return NextResponse.json({ error: "skillId 无效" }, { status: 400 });
    }
    await setUserSkill(userId, skillId, level);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("profile skills set error", e);
    return NextResponse.json({ error: "技能更新失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const skillId = Number(url.searchParams.get("skillId"));
  if (!Number.isInteger(skillId) || skillId <= 0) {
    return NextResponse.json({ error: "skillId 无效" }, { status: 400 });
  }
  try {
    await removeUserSkill(userId, skillId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("profile skills delete error", e);
    return NextResponse.json({ error: "技能移除失败" }, { status: 500 });
  }
}
