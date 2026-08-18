import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { getHostsMeta, listJobSources } from "@/lib/jobs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const [sources, meta] = await Promise.all([listJobSources(), getHostsMeta()]);
  return NextResponse.json({
    sources,
    version: meta?.version ?? 0,
    updatedAt: meta?.updatedAt ?? null,
  });
}
