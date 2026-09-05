import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

/**
 * 公开统计（无需登录）：供静态落地页展示实时数据。
 * 仅返回聚合计数，不包含任何用户数据。
 */
export async function GET() {
  try {
    const { rows } = await pgPool.query(
      "SELECT " +
        "(SELECT count(*)::int FROM job_postings WHERE is_active = true) AS total, " +
        "(SELECT count(*)::int FROM job_postings WHERE is_active = true AND fetched_at >= now() - interval '24 hours') AS today_new, " +
        "(SELECT count(DISTINCT city)::int FROM job_postings WHERE is_active = true) AS city_count, " +
        "(SELECT count(DISTINCT source)::int FROM job_postings WHERE is_active = true) AS platform_count, " +
        "(SELECT round(avg((salary_min + salary_max) / 2.0))::int FROM job_postings WHERE is_active = true AND salary_min > 0 AND salary_max > 0) AS avg_salary, " +
        "(SELECT max(fetched_at) FROM job_postings WHERE is_active = true) AS fetched_at"
    );
    const r = rows[0];
    return NextResponse.json({
      total: r.total,
      todayNew: r.today_new,
      cityCount: r.city_count,
      platformCount: r.platform_count,
      avgSalary: r.avg_salary ?? null,
      fetchedAt: r.fetched_at ? new Date(r.fetched_at).toISOString() : null,
    });
  } catch {
    return NextResponse.json({ error: "统计暂不可用" }, { status: 503 });
  }
}
