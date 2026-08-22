import { NextResponse } from "next/server";
import { getRoadmapWithProgress } from "@/lib/api";
import { currentUserId } from "@/lib/session";
import { getAnonId } from "@/lib/anon";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const career = url.searchParams.get("career") || "ict";
    const uid = await currentUserId();
    const anonId = uid ? null : await getAnonId();
    const phases = await getRoadmapWithProgress(uid, career, anonId);
    return NextResponse.json({ phases });
  } catch (e) {
    console.error("roadmap api error", e);
    return NextResponse.json({ error: "数据库暂不可用" }, { status: 500 });
  }
}