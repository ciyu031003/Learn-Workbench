import { useCallback, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { buildRefreshControlProps, type RefreshControlLike } from "@/lib/pull-refresh-core";

export { STICKY_HEADER_ROW, pullRefreshOffset, buildRefreshControlProps } from "@/lib/pull-refresh-core";
export type { RefreshControlLike } from "@/lib/pull-refresh-core";

export interface UsePullRefreshOptions {
  /** 页面是否有吸顶紧凑栏（默认 true：v17 之后绝大多数子页都有） */
  stickyHeader?: boolean;
  /** 关闭时 onRefresh 不触发（无数据源页面） */
  enabled?: boolean;
}

export interface UsePullRefreshResult {
  refreshing: boolean;
  /** 展开到 <RefreshControl {...control} /> */
  control: RefreshControlLike;
}

/**
 * 统一的下拉刷新 hook。
 * 用法：const { control } = usePullRefresh(load);
 *      <Animated.ScrollView refreshControl={<RefreshControl {...control} />} …>
 *
 * - 重入保护：刷新中再次触发被忽略（避免并发请求把列表打成两半）
 * - 异常吞掉后**仍然复位** refreshing，否则转圈会一直转
 */
export function usePullRefresh(
  onRefresh: () => unknown | Promise<unknown>,
  options: UsePullRefreshOptions = {}
): UsePullRefreshResult {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const enabled = options.enabled ?? true;
  const stickyHeader = options.stickyHeader ?? true;

  /**
   * 重入保护直接用 refreshing 状态判定（不用 useRef —— react-hooks 的
   * "Cannot access refs during render" 规则会把 useCallback 内的 ref 读取判成渲染期访问）。
   */
  const run = useCallback(() => {
    if (!enabled || refreshing) return;
    setRefreshing(true);
    void Promise.resolve()
      .then(() => onRefresh())
      .catch(() => {
        // 页面自己的 loader 已处理错误提示，这里只保证状态复位
      })
      .finally(() => setRefreshing(false));
  }, [enabled, onRefresh, refreshing]);

  const control = useMemo(
    () => buildRefreshControlProps(colors, { refreshing, onRefresh: run, top: insets.top, stickyHeader }),
    [colors, insets.top, refreshing, run, stickyHeader]
  );

  return { refreshing, control };
}
