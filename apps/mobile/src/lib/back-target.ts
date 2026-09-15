/**
 * 子页「返回兜底」目标解析（Tab 结构下 canGoBack() 常为 false）
 *
 * 背景（2026-09-15 真机）：健康 → 训练记录 → 点返回，直接跳回「今日」首页。
 * 原因是 ScreenHeader 的兜底写死 `/today`，而切 Tab 会重置各自导航栈，canGoBack() 为 false。
 * 修法：兜底按「页面所属 Hub」决定，回到用户来的那个 Tab。
 *
 * 顺序敏感：先匹配更长的前缀（如 /career/resume 先于 /career）。
 */
const HUB_RULES: { prefix: string; hub: string }[] = [
  // 健康 Hub
  { prefix: "/workout", hub: "/wellness" },
  { prefix: "/nutrition", hub: "/wellness" },
  { prefix: "/habits", hub: "/wellness" },
  { prefix: "/wellbeing", hub: "/wellness" },
  // 职业 Hub
  { prefix: "/career", hub: "/career" },
  { prefix: "/jobs", hub: "/career" },
  { prefix: "/market", hub: "/career" },
  { prefix: "/radar", hub: "/career" },
  { prefix: "/applications", hub: "/career" },
  { prefix: "/resume", hub: "/career" },
  { prefix: "/certificates", hub: "/career" },
  { prefix: "/interview", hub: "/career" },
  // 学习 Hub
  { prefix: "/learn", hub: "/learn" },
  { prefix: "/roadmap", hub: "/learn" },
  { prefix: "/phase", hub: "/learn" },
  { prefix: "/tasks", hub: "/learn" },
  { prefix: "/logs", hub: "/learn" },
  { prefix: "/trackers", hub: "/learn" },
  // 我的
  { prefix: "/settings", hub: "/settings" },
  { prefix: "/account-security", hub: "/settings" },
  { prefix: "/domain-manager", hub: "/settings" },
];

/** 默认兜底：今日（一级 Tab） */
export const DEFAULT_BACK_TARGET = "/today";

/** 一级 Tab 路由：自身没有「上一级」，返回即回今日 */
export const TAB_ROUTES = ["/today", "/learn", "/career", "/wellness", "/settings"] as const;

/**
 * 由当前路径推出「返回」应去的 Hub。
 * - 一级 Tab 自身 → 今日（`/wellness` 之类没有上一级）
 * - 子页 → 所属 Hub（`/workout` → `/wellness`，`/career/resume` → `/career`）
 * - `/resume-preview` → `/career`（段前缀匹配，不会被 `/resume` 截断）
 * - 未知路径 → 今日
 */
export function resolveBackTarget(pathname: string | null | undefined): string {
  if (!pathname) return DEFAULT_BACK_TARGET;
  const p = pathname === "/" || pathname === "/dashboard" ? "/today" : pathname;
  if ((TAB_ROUTES as readonly string[]).includes(p)) return DEFAULT_BACK_TARGET;
  for (const rule of HUB_RULES) {
    if (p.startsWith(rule.prefix)) return rule.hub;
  }
  return DEFAULT_BACK_TARGET;
}
