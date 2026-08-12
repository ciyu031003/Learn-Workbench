import { NextResponse } from "next/server";
import { getRoadmapWithProgress } from "@/lib/api";
import { currentUserId } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const career = url.searchParams.get("career") || "ict";
    const uid = await currentUserId();
    const phases = await getRoadmapWithProgress(uid, career);
    return NextResponse.json({ phases });
  } catch (e) {
    console.error("roadmap api error", e);
    return NextResponse.json({ error: "数据库暂不可用" }, { status: 500 });
  }
}
