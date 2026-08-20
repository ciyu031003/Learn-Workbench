import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import type { SkillOption } from "@learn-workbench/shared";

export async function GET() {
  try {
    const { rows } = await pgPool.query<{ id: number; name: string; category: string; aliases: string[] }>(
      `SELECT id, name, category, aliases FROM skill_taxonomy ORDER BY category, name`
    );
    const skills: SkillOption[] = rows.map((r) => ({
      id: r.id, name: r.name, category: r.category,
      aliases: Array.isArray(r.aliases) ? r.aliases : [],
    }));
    return NextResponse.json({ skills });
  } catch (e) {
    console.error("jobs skills error", e);
    return NextResponse.json({ error: "技能库加载失败" }, { status: 500 });
  }
}
