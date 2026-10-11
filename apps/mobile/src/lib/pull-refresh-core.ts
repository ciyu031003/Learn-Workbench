/**
 * 下拉刷新的**纯逻辑核心**（v17-D / R9）—— 零 react-native 依赖，vitest 可直接加载。
 *
 * 背景：此前 8 个页面各自手写 RefreshControl，参数口径不一；v17-C2b 引入"吸顶紧凑栏"后
 * progressViewOffset 更是有的写 insets.top + 44、有的写 useHeaderTopInset()，会导致
 * 下拉转圈被吸顶栏盖住或悬空。这里统一口径，并用单测锁死偏移算法。
 *
 * ⚠️ v1.43.9 回归（df275f7 引入，本文件修复）：
 * 该提交把 `ScreenHeaderStickyBar` 从「绝对定位悬浮」改成「普通文档流」
 * （components/screen-header.tsx:165 `paddingTop: insets.top` + :213 `position: "relative"`，
 * 行高 `stickyRow.height = STICKY_HEADER_ROW`）。顶栏现在**占据** insets.top + 44 的布局高度，
 * 滚动容器的原点随之下移同样的高度；而 `progressViewOffset` 是**相对滚动容器**计量的
 * （Android: node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/swiperefresh/ReactSwipeRefreshLayout.kt:42-53，
 * iOS: node_modules/react-native/React/Views/RefreshControl/RCTRefreshControl.m:140-158），
 * 所以再追加 44 就是**双重计算**：13 个可下拉页面的转圈被额外下推 44pt（观感"悬空/过低"）。
 *
 * 结论（v1.43.10）：`stickyHeader` 不再追加 `STICKY_HEADER_ROW`，偏移恒等于安全区顶部 `top`；
 * 无顶栏页面（stickyHeader: false）行为不变。回归护栏见 pull-refresh-core.test.ts。
 */

/** 顶栏一行的高度（与 components/screen-header.tsx 的 stickyRow.height 一致；该文件由 Lead 拥有，改一处要两处一起改） */
export const STICKY_HEADER_ROW = 44;

/**
 * 下拉转圈相对滚动容器顶部的偏移。
 *
 * - `top`：安全区顶部（insets.top）。转圈相对滚动容器定位，无顶栏页面的容器原点在 y=0，
 *   需要这段偏移把转圈从状态栏下方推出来。
 * - `stickyHeader`：页面是否有顶栏。**保留入参只为兼容 13 个调用点**
 *   （apps/mobile/src/app/** 由 Lead 拥有，本次不改）；自 df275f7 起顶栏是普通文档流节点，
 *   它占的高度已经体现在滚动容器原点上 → 不再追加 STICKY_HEADER_ROW。
 *
 * 非法/负的 `top` 归零，不产生 NaN。
 */
export function pullRefreshOffset(opts: { top: number; stickyHeader?: boolean }): number {
  const top = Number.isFinite(opts.top) && opts.top > 0 ? opts.top : 0;
  // v1.43.9 回归修复：这里**故意不读** opts.stickyHeader —— 顶栏进入文档流后，
  // "顶栏高度"已由滚动容器原点承担（见文件头注释），再叠加 44 即双重计算。
  // 保留该字段只为不改动 app/** 的 13 个调用点（类型上多传属性会报错）。
  return top;
}

/** 与 RN RefreshControl 的 props 对齐（本地声明，避免 import react-native 而无法单测） */
export interface RefreshControlLike {
  refreshing: boolean;
  onRefresh: () => void;
  tintColor: string;
  colors: string[];
  progressBackgroundColor: string;
  progressViewOffset: number;
}

/**
 * 算出 RefreshControl 的全部 props。
 * 主题色口径：tintColor(iOS) 与 colors[0](Android) 走主色；转圈背景走 surfaceStrong（深色下不再是一片白）。
 */
export function buildRefreshControlProps(
  colors: { primary: string; surfaceStrong: string },
  opts: { refreshing: boolean; onRefresh: () => void; top: number; stickyHeader?: boolean }
): RefreshControlLike {
  return {
    refreshing: opts.refreshing,
    onRefresh: opts.onRefresh,
    tintColor: colors.primary,
    colors: [colors.primary],
    progressBackgroundColor: colors.surfaceStrong,
    progressViewOffset: pullRefreshOffset({ top: opts.top, stickyHeader: opts.stickyHeader }),
  };
}
