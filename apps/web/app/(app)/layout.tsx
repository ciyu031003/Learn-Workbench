import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClientProviders } from "@/components/client-providers";
import { VitalsReporter } from "@/components/vitals-reporter";
import { getShellData } from "@/lib/shell-data";

/**
 * 登录区路由组（S3-3 / S6-2）：服务端守卫 + AppShell。
 *
 * - 服务端先校验会话：未登录直接 307 到 /login，不渲染任何页面壳；
 * - S6-2：外壳所需的 user/domains/currentCareer/overallPercent 也在这里**服务端取数**，
 *   一次传给 AppShell（首屏不再有 /api/domains、/api/summary、/api/auth/me 等壳层 XHR）。
 */
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const shellData = await getShellData();
  if (!shellData) redirect("/login");
  return (
    <AppShell shellData={shellData}>
      {/* S6-8：首屏动效分档（html[data-motion]）+ Web Vitals 采样（仅登录区，匿名聚合） */}
      <VitalsReporter />
      {/* S8-c：主题运行时同步（空闲时加载）；公开页不加载，靠根布局内联脚本兜底首屏主题 */}
      <ClientProviders />
      {children}
    </AppShell>
  );
}
