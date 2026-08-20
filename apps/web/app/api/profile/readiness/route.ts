import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { computeReadiness } from "@/lib/readiness";

export async function GET() {
  try {
    const userId = await currentUserId();
    const readiness = await computeReadiness(userId);
    return NextResponse.json(readiness);
  } catch (e) {
    console.error("readiness api error", e);
    return NextResponse.json({ error: "数据库暂不可用" }, { status: 500 });
  }
}
