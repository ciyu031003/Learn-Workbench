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

/**
 * 路径所属「模块」（一级 Tab 返回自身，子页返回所属 Hub）。
 * 与 resolveBackTarget 的区别：Hub 自身返回自己而不是今日 —— 判断模块归属用这个。
 */
export function hubOf(pathname: string | null | undefined): string {
  if (!pathname) return DEFAULT_BACK_TARGET;
  const p = pathname === "/" || pathname === "/dashboard" ? "/today" : pathname;
  if ((TAB_ROUTES as readonly string[]).includes(p)) return p;
  for (const rule of HUB_RULES) {
    if (p.startsWith(rule.prefix)) return rule.hub;
  }
  return DEFAULT_BACK_TARGET;
}

/**
 * 上一个展示过的页面（由根布局在每次路径变化时记录）。
 *
 * 真机反馈（2026-09-22 v1.21.0）：在「职业 → 面试 / 证书」点返回，直接回到了「今日」首页。
 * 原因是 Tab 结构下 `router.back()` 走的是 Tabs 的历史（上一个是哪个 Tab），
 * 而不是"这个子页从哪个模块进来的"。现在的规则：
 *   - 上一个页面与本页**同属一个模块** → 真实 `back()`（保留"从哪来回哪去"，如 路线图 → 阶段详情）
 *   - **跨模块**（如 今日 → 面试）→ `replace(所属 Hub)`，回到该模块首页，而不是今日
 */
let lastPath: string | null = null;

/** 根布局每次路径变化时调用 */
export function noteScreenPath(pathname: string | null | undefined): void {
  lastPath = pathname ?? null;
}

/** 本页与上一个展示过的页面是否同属一个模块 */
export function isSameHubAsLast(pathname: string | null | undefined): boolean {
  if (lastPath === null) return false;
  return hubOf(lastPath) === hubOf(pathname);
}

/** 仅测试用：清空记忆 */
export function __resetBackTargetMemory(): void {
  lastPath = null;
}
