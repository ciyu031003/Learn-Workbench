/**
 * 边缘横滑切 Tab 的平台默认值（纯函数，不依赖 react-native，便于单测）。
 *
 * - iOS：保留 iOS 风格的左右边缘横滑（系统本身没有返回手势，无冲突）
 * - Android：默认关闭。系统的「返回」手势本身就占用屏幕左右边缘，
 *   两者同时启用会互相抢触摸；这也是国产 ROM（OPPO/ColorOS 等）上
 *   「界面正常但点不动」的诱因之一。
 *
 * 用户可在「我的 → 手势」里自行打开（显式设置后以用户设置为准）。
 */
const DEFAULT_BY_PLATFORM: Record<string, boolean> = {
  ios: true,
  android: false,
};

export const EDGE_SWIPE_DEFAULT = false;

/** 解析最终生效值：用户显式设置优先，未设置（null/undefined）走平台默认 */
export function resolveEdgeSwipeEnabled(stored: boolean | null | undefined, os: string): boolean {
  return stored ?? DEFAULT_BY_PLATFORM[os] ?? EDGE_SWIPE_DEFAULT;
}
