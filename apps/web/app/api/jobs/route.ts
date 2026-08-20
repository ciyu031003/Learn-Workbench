import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { queryJobs, type JobListQuery } from "@/lib/jobs";

export async function GET(req: Request) {
  const userId = await currentUserId();
  const url = new URL(req.url);
  const sp = url.searchParams;
  const params: JobListQuery = {
    q: sp.get("q")?.trim() || undefined,
    city: sp.get("city")?.trim() || undefined,
    category: undefined,
    categories: sp.get("category")?.split(",").filter(Boolean) || undefined,
    channels: sp.get("channels")?.split(",").filter(Boolean) || undefined,
    platforms: sp.get("platforms")?.split(",").filter(Boolean) || undefined,
    provinces: sp.get("provinces")?.split(",").filter(Boolean) || undefined,
    sort: sp.get("sort") || "new",
    page: Math.max(1, Number(sp.get("page") || 1) || 1),
    pageSize: Math.min(60, Math.max(1, Number(sp.get("pageSize") || 20) || 20)),
    userId,
    // ---- P1 多条件筛选 ----
    salaryMin: sp.has("salaryMin") ? Number(sp.get("salaryMin")) || undefined : undefined,
    salaryMax: sp.has("salaryMax") ? Number(sp.get("salaryMax")) || undefined : undefined,
    education: sp.get("education")?.split(",").filter(Boolean) || undefined,
    experience: sp.get("experience")?.split(",").filter(Boolean) || undefined,
    publishedWithin: (sp.get("publishedWithin") as "today" | "3d" | "7d" | null) ?? undefined,
    skills: sp.get("skills")?.split(",").filter(Boolean) || undefined,
    includeSources: sp.get("includeSources") === "1",
  };
  const { jobs, total } = await queryJobs(params);
  return NextResponse.json({ jobs, total, page: params.page, pageSize: params.pageSize });
}
