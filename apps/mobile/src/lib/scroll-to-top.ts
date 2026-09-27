import { useEffect, type RefObject } from "react";

/**
 * v19-M8 · Tab 双击回顶的事件总线。
 *
 * iOS 心智：底栏上**再点一次已聚焦的 Tab** = 回到该页顶部。实现分两半：
 *  - TabBar 侧（(tabs)/_layout.tsx）：每个 Tabs.Screen 挂 `listeners.tabPress`，
 *    发现 pressed 的就是当前已聚焦 Tab 时 `scrollToTop(key)`；
 *  - Hub 侧：`useScrollToTopHandler(key, scrollRef)` 注册自己的滚动容器。
 *
 * key 一律用带斜杠的路由（"/today"），与 usePathname() 的取值一致（"/" 归一化为 "/today"）。
 * 纯模块（Map + 函数），不依赖 RN —— hub 卸载时必须走返回的注销函数，防止持有已卸载 ref。
 */
const handlers = new Map<string, () => void>();

export function registerScrollToTop(key: string, fn: () => void): () => void {
  handlers.set(key, fn);
  return () => {
    if (handlers.get(key) === fn) handlers.delete(key);
  };
}

export function scrollToTop(key: string): void {
  handlers.get(key)?.();
}

/**
 * Hub 侧注册：把"回顶"落到自己的滚动容器上。
 * ref 类型刻意收窄成 `scrollTo` 结构类型 —— ScrollView 与 Reanimated 的 Animated.ScrollView
 * 都满足，不必把 reanimated 类型引进本模块。
 */
export function useScrollToTopHandler(
  key: string,
  ref: RefObject<{ scrollTo?: (opts: { y: number; animated?: boolean }) => void } | null>
): void {
  useEffect(
    () =>
      registerScrollToTop(key, () => {
        ref.current?.scrollTo?.({ y: 0, animated: true });
      }),
    [key, ref]
  );
}
