import { getDashboardPageData } from "@/lib/dashboard-data";
import { DashboardView } from "./dashboard-view";

/**
 * Dashboard（S6-2 RSC 试点）：Server Component 直调 lib 取首屏数据。
 *
 * - 数据：lib/dashboard-data.ts（summary + readiness + wellbeing），与 /api/dashboard、
 *   /api/wellbeing/today 共用同一实现；客户端不再发这两个 XHR。
 * - `revalidate = 30`：30 秒内重复访问复用同一 RSC 结果（用户态数据仍受 layout 的
 *   force-dynamic + 会话校验约束，不会跨用户共享）。
 * - 交互仍由 dashboard-view.tsx（"use client"）承担，刷新走 router.refresh()。
 */
// 注：父级 (app)/layout 是 force-dynamic（服务端会话守卫），这里的 revalidate 实际不会生效。
// 保留导出是为了将来把会话守卫下沉到 middleware 后再启用 30s 缓存；当前按请求动态渲染。

export default async function DashboardPage() {
  const data = await getDashboardPageData();
  return (
    <DashboardView
      initialSummary={data.summary}
      initialReadiness={data.readiness}
      initialWellbeing={data.wellbeing}
    />
  );
}
