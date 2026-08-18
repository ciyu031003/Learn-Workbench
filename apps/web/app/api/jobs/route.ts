import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { queryJobs, type JobListQuery } from "@/lib/jobs";

export async function GET(req: Request) {
  const userId = await currentUserId();
  const url = new URL(req.url);
  const params: JobListQuery = {
    q: url.searchParams.get("q")?.trim() || undefined,
    city: url.searchParams.get("city")?.trim() || undefined,
    category: undefined,
    categories: url.searchParams.get("category")?.split(",").filter(Boolean) || undefined,
    channels: url.searchParams.get("channels")?.split(",").filter(Boolean) || undefined,
    platforms: url.searchParams.get("platforms")?.split(",").filter(Boolean) || undefined,
    provinces: url.searchParams.get("provinces")?.split(",").filter(Boolean) || undefined,
    sort: url.searchParams.get("sort") || "new",
    page: Math.max(1, Number(url.searchParams.get("page") || 1) || 1),
    pageSize: Math.min(60, Math.max(1, Number(url.searchParams.get("pageSize") || 20) || 20)),
    userId,
  };
  const { jobs, total } = await queryJobs(params);
  return NextResponse.json({ jobs, total, page: params.page, pageSize: params.pageSize });
}
