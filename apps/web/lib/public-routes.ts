/**
 * 公开路由（无需登录校验即可访问）。
 *
 * 与 `proxy.ts` 的服务端守卫、`components/app-shell.tsx` 的客户端会话校验共用同一份判定，
 * 避免两边规则漂移（服务端放行、客户端却踢回 /login）。
 *
 * 匹配规则：
 * - `"/"` 只匹配根路径本身（落地页），不做前缀匹配 —— 否则所有路由都会被当成公开页；
 * - 其余前缀匹配自身与子路径（`/login`、`/login/xxx`；`/share`、`/share/sport/1`）；
 * - 边界安全：`/sharel`、`/loginx` 这类"同前缀不同段"的路径不命中。
 */
export const PUBLIC_PREFIXES = ["/", "/login", "/share"] as const;

/**
 * 判断 pathname 是否为公开路径。
 *
 * 入参通常是 `usePathname()` 的值（不含 query/hash），但这里仍会剥离 query/hash 与尾部斜杠，
 * 保证带参 / 不带参、带尾斜杠 / 不带尾斜杠的调用得到一致结果。
 */
export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const [pathOnly = ""] = pathname.split(/[?#]/);
  // 尾部斜杠归一："/share/" 与 "/share" 等价；"/" 归一为 "/"，避免空串
  const normalized = pathOnly.replace(/\/+$/, "") || "/";
  if (normalized === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => prefix !== "/" && (normalized === prefix || normalized.startsWith(prefix + "/"))
  );
}
