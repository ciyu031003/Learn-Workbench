/**
 * 下拉刷新的**纯逻辑核心**（v17-D / R9）—— 零 react-native 依赖，vitest 可直接加载。
 *
 * 背景：此前 8 个页面各自手写 RefreshControl，参数口径不一；v17-C2b 引入"吸顶紧凑栏"后
 * progressViewOffset 更是有的写 insets.top + 44、有的写 useHeaderTopInset()，会导致
 * 下拉转圈被吸顶栏盖住或悬空。这里统一口径，并用单测锁死偏移算法。
 */

/** 吸顶紧凑栏的高度（与 components/screen-header.tsx 的吸顶行一致；该文件由 Lead 拥有，改一处要两处一起改） */
export const STICKY_HEADER_ROW = 44;

/** 下拉转圈相对滚动容器顶部的偏移 */
export function pullRefreshOffset(opts: { top: number; stickyHeader?: boolean }): number {
  const top = Number.isFinite(opts.top) && opts.top > 0 ? opts.top : 0;
  return opts.stickyHeader ? top + STICKY_HEADER_ROW : top;
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
