/**
 * 二级页「大标题 + 吸顶栏」协同规则：
 * 页面顶部只显示内容里的大标题；滚动过标题区后，顶部栏才淡入同名紧凑标题。
 *
 * 返回 0–1 的透明度。0 = 还在页头（不重复标题），1 = 标题已滚出视口。
 * 带 "worklet" 指令：会在 ScreenHeaderStickyBar 的 useAnimatedStyle 里被调用
 * （与 celebration-particles 的 burstRingStateAt 同一约束）。
 */
export const COMPACT_TITLE_START = 24;
export const COMPACT_TITLE_END = 64;

export function compactTitleOpacity(offsetY: number): number {
  "worklet";
  if (!Number.isFinite(offsetY)) return 0;
  if (offsetY <= COMPACT_TITLE_START) return 0;
  if (offsetY >= COMPACT_TITLE_END) return 1;
  const progress = (offsetY - COMPACT_TITLE_START) / (COMPACT_TITLE_END - COMPACT_TITLE_START);
  return Math.round(progress * 100) / 100;
}
