import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { runJobClustering } from "@/lib/job-clusters";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const result = await runJobClustering(7);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("job clustering error", e);
    return NextResponse.json({ error: "去重聚类失败" }, { status: 500 });
  }
}
