/**
 * 子页「返回上一级」目标解析（Tab 结构下 `router.back()` 常常回错）
 *
 * 背景（2026-09-15 真机）：健康 → 训练记录 → 点返回，直接跳回「今日」首页。
 * 后续（2026-09-22 v14）曾用「同模块才 back()」的启发式修补，但真机仍然出现
 * 「健康子页 / 招花页返回都回今日」——根因是 expo-router 的 <Tabs> 把 app/ 下
 * **所有**路由都注册成了 Tab（次级页只是 href:null），所以 tab 之间切换走的是
 * Tabs 的历史，而不是"子页压栈"。`back()` 因此回的是"上一个看过的 Tab"。
 *
 * 2026-09-24 定稿规则（用户要求）：**每个模块的子页返回 → 它的上一级**，
 * 绝不使用 `router.back()`，全部走显式 `router.replace(上一级)`。
 *   - /nutrition、/workout、/habits、/sports-card、/trackers → /wellness
 *   - /jobs、/market、/radar、/applications、/resume、/certificates、/interview → /career
 *   - /roadmap、/tasks、/logs → /learn；/phase/[id] → /roadmap（真正上一级）
 *   - /account-security、/domain-manager、/diagnostics → /settings
 *   - 一级 Tab 自身没有上一级 → 今日
 *
 * 顺序敏感：先匹配更长的前缀（/resume-preview 必须先于 /resume）。
 */

/** 子页 → 直接上一级（有序，长前缀在前） */
const PARENT_RULES: { prefix: string; parent: string }[] = [
  // 学习
  { prefix: "/phase", parent: "/roadmap" },
  { prefix: "/roadmap", parent: "/learn" },
  { prefix: "/tasks", parent: "/learn" },
  { prefix: "/logs", parent: "/learn" },
  // 职业
  { prefix: "/resume-preview", parent: "/resume" },
  { prefix: "/resume", parent: "/career" },
  { prefix: "/jobs", parent: "/career" },
  { prefix: "/market", parent: "/career" },
  { prefix: "/radar", parent: "/career" },
  { prefix: "/applications", parent: "/career" },
  { prefix: "/certificates", parent: "/career" },
  { prefix: "/interview", parent: "/career" },
  // 健康
  { prefix: "/workout", parent: "/wellness" },
  { prefix: "/nutrition", parent: "/wellness" },
  { prefix: "/habits", parent: "/wellness" },
  { prefix: "/wellbeing", parent: "/wellness" },
  { prefix: "/sports-card", parent: "/wellness" },
  { prefix: "/trackers", parent: "/wellness" },
  // 我的
  { prefix: "/account-security", parent: "/settings" },
  { prefix: "/domain-manager", parent: "/settings" },
  { prefix: "/diagnostics", parent: "/settings" },
];

/** 兼容旧调用：Hub 归属（子页 → 所属一级 Tab） */
const HUB_RULES: { prefix: string; hub: string }[] = [
  { prefix: "/workout", hub: "/wellness" },
  { prefix: "/nutrition", hub: "/wellness" },
  { prefix: "/habits", hub: "/wellness" },
  { prefix: "/wellbeing", hub: "/wellness" },
  { prefix: "/sports-card", hub: "/wellness" },
  { prefix: "/trackers", hub: "/wellness" },
  { prefix: "/career", hub: "/career" },
  { prefix: "/jobs", hub: "/career" },
  { prefix: "/market", hub: "/career" },
  { prefix: "/radar", hub: "/career" },
  { prefix: "/applications", hub: "/career" },
  { prefix: "/resume", hub: "/career" },
  { prefix: "/certificates", hub: "/career" },
  { prefix: "/interview", hub: "/career" },
  { prefix: "/learn", hub: "/learn" },
  { prefix: "/roadmap", hub: "/learn" },
  { prefix: "/phase", hub: "/learn" },
  { prefix: "/tasks", hub: "/learn" },
  { prefix: "/logs", hub: "/learn" },
  { prefix: "/settings", hub: "/settings" },
  { prefix: "/account-security", hub: "/settings" },
  { prefix: "/domain-manager", hub: "/settings" },
  { prefix: "/diagnostics", hub: "/settings" },
];

/** 默认兜底：今日（一级 Tab） */
export const DEFAULT_BACK_TARGET = "/today";

/** 一级 Tab 路由：自身没有「上一级」，返回即回今日 */
export const TAB_ROUTES = ["/today", "/learn", "/career", "/wellness", "/settings"] as const;

function normalize(pathname: string): string {
  if (pathname === "/" || pathname === "" || pathname === "/dashboard") return "/today";
  return pathname;
}

/**
 * 由当前路径推出「返回」应去的**上一级**。
 * - 一级 Tab 自身 → 今日
 * - 二级子页 → 它的直接上一级（/phase/[id] → /roadmap，而不是 /learn）
 * - 未知路径 → 所属 Hub，再不行 → 今日
 */
export function resolveBackTarget(pathname: string | null | undefined): string {
  if (!pathname) return DEFAULT_BACK_TARGET;
  const p = normalize(pathname);
  if ((TAB_ROUTES as readonly string[]).includes(p)) return DEFAULT_BACK_TARGET;
  for (const rule of PARENT_RULES) {
    if (p.startsWith(rule.prefix)) return rule.parent;
  }
  for (const rule of HUB_RULES) {
    if (p.startsWith(rule.prefix)) return rule.hub;
  }
  return DEFAULT_BACK_TARGET;
}

/**
 * 路径所属「模块」（一级 Tab 返回自身，子页返回所属 Hub）。
 * 保留给需要"我在哪个模块"语义的调用方。
 */
export function hubOf(pathname: string | null | undefined): string {
  if (!pathname) return DEFAULT_BACK_TARGET;
  const p = normalize(pathname);
  if ((TAB_ROUTES as readonly string[]).includes(p)) return p;
  for (const rule of HUB_RULES) {
    if (p.startsWith(rule.prefix)) return rule.hub;
  }
  return DEFAULT_BACK_TARGET;
}

/**
 * 上一个展示过的页面（由根布局在每次路径变化时记录）。
 * @deprecated 2026-09-24 起返回逻辑改为显式「上一级」，不再依赖 back() 与历史记录。
 * 仅保留给"是否同模块"这类提示场景。
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
