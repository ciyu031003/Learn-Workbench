/**
 * 底栏占位几何（悬浮液态玻璃胶囊底栏，见 docs/APP端优化方案-v2-问题修复与UI精修.md Bug 2）
 *
 * 背景（2026-09-15 真机）：底栏是浮动胶囊，`bottom:16 + height:62` 共占 78pt，
 * 而各屏内容底部留白零散（32/40/48/96/110/118 混用），11 个页面滚到底被压住最后一行。
 * 修法：所有可滚动页统一用 `tabBarSpaceFor()` 作为 `paddingBottom` 下限。
 *
 * v2.1（参考图 2「白色玻璃浮动胶囊」）：本体 62 → 66、悬浮间距 8 → 10，
 * 并新增左右留白 / 全圆角两个常量 —— 全部页面经 `tabBarSpaceFor()` 自动跟着变，
 * 不需要逐屏改数字。**改任一数字都要同步 `tab-bar-metrics.test.ts` 的几何契约**，
 * 底栏占位只能变大不能变小，否则又会压住内容。
 *
 * 本文件保持**纯函数**（不 import react-native），便于单测；
 * 需要安全区的组件用 `@/lib/use-tab-bar-space` 的 `useTabBarSpace()`。
 */
/** 底栏（悬浮胶囊）本体高度，不含安全区（v2.1：66，参考图 2 的 64–68 区间） */
export const TAB_BAR_HEIGHT = 66;
/** 悬浮胶囊离底部安全区的间距（v2.1：10） */
export const TAB_BAR_FLOAT_GAP = 10;
/** 胶囊左右留白（v2.1：14，参考图 2 的 12–16 区间） */
export const TAB_BAR_SIDE_INSET = 14;
/** 胶囊圆角 = 半径一半 → 两端完全半圆的「全圆角胶囊」 */
export const TAB_BAR_RADIUS = TAB_BAR_HEIGHT / 2;
/** 底栏之上的呼吸留白，避免最后一行贴着底栏 */
export const TAB_BAR_BREATHING = 18;

/**
 * 可滚动内容底部需要的留白 = 胶囊高 + 悬浮间距 + 安全区 + 呼吸。
 * @param insetBottom 设备底部安全区（异常值按 0 处理）
 * @param extra 追加留白（如页面自带的浮动按钮）
 */
export function tabBarSpaceFor(insetBottom: number, extra = 0): number {
  const safe = Number.isFinite(insetBottom) ? Math.max(0, insetBottom) : 0;
  return TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + safe + TAB_BAR_BREATHING + extra;
}

/**
 * 底栏**可见**的路由（v17 阶段 B）。
 *
 * 迁移前 app/ 下所有页面都是 Tab（次级页 href:null），底栏处处都在；
 * 迁移后只有 \`(tabs)\` 组内的这 7 个路由拥有底栏 —— 其余页面都是根 Stack 的 push 目标，
 * 会把底栏整块盖住（这正是 D2 想要的 iOS 层级气质）。
 * 因此这些页面的底部留白不能再按"底栏占位"算，否则滚到底会多出一段死白。
 */
export const TAB_BAR_ROUTES = ["/", "/today", "/learn", "/career", "/wellness", "/settings", "/dashboard"] as const;

/** 路径归一化：去掉 query / 末尾斜杠，补前导斜杠；空值按根路径处理 */
function normalizeRoutePath(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  let p = pathname.split("?")[0];
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p === "" ? "/" : p;
}

/** 当前路由是否显示底部 Tab 栏 */
export function showsTabBar(pathname: string | null | undefined): boolean {
  return (TAB_BAR_ROUTES as readonly string[]).includes(normalizeRoutePath(pathname));
}

/**
 * 按**当前路由**给出可滚动内容底部该留的空白。
 * - 底栏可见（hub 页）：底栏高 + 悬浮间距 + 安全区 + 呼吸 + extra
 * - 底栏被盖住（push 子页）：只留安全区 + extra（避免内容压到 home indicator 下）
 */
export function tabBarSpaceForRoute(pathname: string | null | undefined, insetBottom: number, extra = 0): number {
  const safe = Number.isFinite(insetBottom) ? Math.max(0, insetBottom) : 0;
  return showsTabBar(pathname) ? tabBarSpaceFor(safe, extra) : safe + extra;
}

/** 固定底栏（页面自带的一排按钮）应该停在哪：胶囊顶 + 间距 */
export function tabBarBottomFor(insetBottom: number): number {
  const safe = Number.isFinite(insetBottom) ? Math.max(0, insetBottom) : 0;
  return TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + safe;
}
