import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { queryJobs } from "@/lib/jobs";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const pageSize = Math.min(60, Math.max(1, Number(url.searchParams.get("pageSize") || 20) || 20));
  const { jobs, total } = await queryJobs({
    userId,
    favOnly: true,
    page,
    pageSize,
    sort: url.searchParams.get("sort") || "new",
  });
  return NextResponse.json({ jobs, total, page, pageSize });
}
