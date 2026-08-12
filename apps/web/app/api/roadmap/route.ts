import { NextResponse } from "next/server";
import { getRoadmapWithProgress } from "@/lib/api";

export async function GET() {
  try {
    const phases = await getRoadmapWithProgress();
    return NextResponse.json({ phases });
  } catch (e) {
    console.error("roadmap api error", e);
    return NextResponse.json({ error: "数据库暂不可用" }, { status: 500 });
  }
}
