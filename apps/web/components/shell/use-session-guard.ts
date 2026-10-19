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
 * 会话有效性校验（从 app-shell.tsx 的 effect 原样抽出，行为不变）。
 *
 * - 只保护非公开路径；
 * - 不再因"查不到 user"而 POST /api/auth/logout（登出仅由用户主动触发）；
 * - 组件卸载后不再 setState / 跳转（alive 守卫）。
 */
export function useSessionGuard(pathname: string): void {
  const router = useRouter();

  useEffect(() => {
    if (!shouldGuardSession(pathname)) return;
    let alive = true;
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return { __error: true };
        return r.json();
      })
      .then((d: { __error?: boolean; user?: unknown } | null) => {
        if (!alive || !d || d.__error) return;
        if (!d.user) {
          router.replace(buildLoginRedirect(pathname));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname, router]);
}
