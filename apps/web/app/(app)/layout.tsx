import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { currentUserId } from "@/lib/session";

/**
 * 登录区路由组（S3-3）：服务端守卫 + AppShell。
 *
 * - 服务端先校验会话：未登录直接 307 到 /login，不渲染任何页面壳（不再"先闪一下再被客户端弹走"）；
 * - AppShell 只在这一组挂载：公开页（/、/login、/share）不再下载 nav/toast/浮层那套客户端包。
 */
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const uid = await currentUserId().catch(() => null);
  if (!uid) redirect("/login");
  return <AppShell>{children}</AppShell>;
}
