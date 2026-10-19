"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isPublicPath } from "@/lib/public-routes";

/**
 * 纯判断：该路径是否需要校验会话。
 *
 * 公开路径（`/`、`/login`、`/share/**`）直接放行，避免把匿名访客踢去 /login；
 * 其余路径需要校验（未登录 -> 重定向登录页）。
 */
export function shouldGuardSession(pathname: string | null | undefined): boolean {
  return !isPublicPath(pathname);
}

/** 登录重定向地址（带来源路径，登录后可回跳）。 */
export function buildLoginRedirect(pathname: string): string {
  return `/login?from=${encodeURIComponent(pathname)}`;
}

/**
 * 会话守卫（S6-2：不再请求 /api/auth/me）。
 *
 * 会话有效性由 (app)/layout.tsx 在**服务端**校验（未登录直接 redirect，页面不会渲染）；
 * 这里只做客户端兜底：如果服务端给的 user 为空（例如刷新后会话被吊销），跳登录页。
 * 相比原实现省掉一次壳层请求。
 */
export function useSessionGuard(pathname: string, hasUser: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!shouldGuardSession(pathname)) return;
    if (!hasUser) router.replace(buildLoginRedirect(pathname));
  }, [pathname, hasUser, router]);
}
