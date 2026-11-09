/**
 * 底栏占位几何（对齐优化 demo 的全宽白色底栏 `.tabbar`）
 *
 * 背景（2026-09-15 真机）：底栏曾是浮动胶囊，各屏内容底部留白零散，
 * 11 个页面滚到底被压住最后一行。修法：所有可滚动页统一用 `tabBarSpaceFor()`
 * 作为 `paddingBottom` 下限。
 *
 * 2026-11 对齐 demo：底栏由「悬浮液态玻璃胶囊」改为 demo 的**全宽白色底栏**
 * （左 0 右 0 贴底、高 68、顶部 1px 分隔线、无悬浮间距、无圆角）。
 * 因此悬浮间距 / 左右留白 / 圆角均为 0，保留常量名以免破坏既有引用。
 * 改任一数字都要同步 `tab-bar-metrics.test.ts` 的几何契约，
 * 底栏占位只能变大不能变小，否则又会压住内容。
 *
 * 本文件保持**纯函数**（不 import react-native），便于单测；
 * 需要安全区的组件用 `@/lib/use-tab-bar-space` 的 `useTabBarSpace()`。
 */
/** 底栏本体高度（demo `.tabbar` height:68），不含安全区 */
export const TAB_BAR_HEIGHT = 68;
/** 单格内容必须容纳的最小高度（24 图标 + 4 间距 + 15 标签） */
export const TAB_BAR_ITEM_MIN_HEIGHT = 44;
/** 全宽底栏不再悬浮，离底部间距为 0（保留常量名） */
export const TAB_BAR_FLOAT_GAP = 0;
/** 全宽底栏左右贴边，无留白（保留常量名） */
export const TAB_BAR_SIDE_INSET = 0;
/** 全宽底栏不做圆角（保留常量名） */
export const TAB_BAR_RADIUS = 0;
/** 底栏之上的呼吸留白，避免最后一行贴着底栏 */
export const TAB_BAR_BREATHING = 18;

/**
 * 可滚动内容底部需要的留白 = 底栏高 + 安全区 + 呼吸（全宽底栏无悬浮间距）。
 * @param insetBottom 设备底部安全区（异常值按 0 处理）
 * @param extra 追加留白（如页面自带的浮动按钮）
 */
export function tabBarSpaceFor(insetBottom: number, extra = 0): number {
  const safe = Number.isFinite(insetBottom) ? Math.max(0, insetBottom) : 0;
  return TAB_BAR_HEIGHT + safe + TAB_BAR_BREATHING + extra;
}

/**
 * 底栏总高 = 固定内容区 68 + 底部安全区。
 *
 * 安全区是**追加**在内容区之外的 padding，不能从 68 里扣。旧实现把
 * `paddingBottom` 塞进 68，手势条一出现内容区就只剩 36，图标/标签溢出，
 * 表现为「图标顶在上沿、文字贴到底边」。
 */
export function tabBarTotalHeight(insetBottom: number): number {
  const safe = Number.isFinite(insetBottom) ? Math.max(0, insetBottom) : 0;
  return TAB_BAR_HEIGHT + safe;
}

/** 底栏内部只让安全区占 padding，内容区始终保留完整 68。 */
export function tabBarRowPaddingBottom(insetBottom: number): number {
  return Number.isFinite(insetBottom) ? Math.max(0, insetBottom) : 0;
}

/**
 * 底栏**可见**的路由（v17 阶段 B）。
 *
 * 迁移前 app/ 下所有页面都是 Tab（次级页 href:null），底栏处处都在；
 * 迁移后只有 `(tabs)` 组内的这 7 个路由拥有底栏 —— 其余页面都是根 Stack 的 push 目标，
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
 * - 底栏可见（hub 页）：底栏高 + 安全区 + 呼吸 + extra
 * - 底栏被盖住（push 子页）：只留安全区 + extra（避免内容压到 home indicator 下）
 */
export function tabBarSpaceForRoute(pathname: string | null | undefined, insetBottom: number, extra = 0): number {
  const safe = Number.isFinite(insetBottom) ? Math.max(0, insetBottom) : 0;
  return showsTabBar(pathname) ? tabBarSpaceFor(safe, extra) : safe + extra;
}

/** 固定底栏（页面自带的一排按钮）应该停在哪：全宽底栏顶 + 安全区 */
export function tabBarBottomFor(insetBottom: number): number {
  const safe = Number.isFinite(insetBottom) ? Math.max(0, insetBottom) : 0;
  return TAB_BAR_HEIGHT + safe;
}
