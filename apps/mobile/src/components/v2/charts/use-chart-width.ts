import { useCallback, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

/**
 * 图表宽度自适应：onLayout 实测容器宽度，首帧先用 fallback。
 *
 * 为什么不用 useWindowDimensions：这些图表都嵌在卡片/两列栅格里，
 * 屏宽 ≠ 可用宽（还要减掉页面内边距与卡间距），实测容器宽才不会溢出或留白。
 * 首帧给 fallback（320）是为了避免 `<Svg width={0}>` 让折线/雷达闪一帧空白。
 */
export function useChartWidth(fallback = 320) {
  const [width, setWidth] = useState(fallback);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (!Number.isFinite(next) || next <= 0) return;
    // 亚像素抖动不触发重渲染（横竖屏切换时会连续回调）
    setWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
  }, []);

  return { width, onLayout };
}
