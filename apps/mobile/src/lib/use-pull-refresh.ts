import { useCallback, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { buildRefreshControlProps, type RefreshControlLike } from "@/lib/pull-refresh-core";
import { haptics } from "@/lib/haptics";

export { STICKY_HEADER_ROW, pullRefreshOffset, buildRefreshControlProps } from "@/lib/pull-refresh-core";
export type { RefreshControlLike } from "@/lib/pull-refresh-core";

export interface UsePullRefreshOptions {
  /**
   * 页面是否有顶栏（默认 true：v17 之后绝大多数子页都有）。
   *
   * ⚠️ v1.43.10：该开关**不再影响下拉刷新偏移** —— df275f7 起顶栏是普通文档流节点
   * （components/screen-header.tsx:165/213），它占的高度已体现在滚动容器原点上，
   * 再叠加 STICKY_HEADER_ROW 就是双重计算（转圈被额外下推 44pt，v1.43.9 回归）。
   * 保留该入参只为不改动 app/** 下 13 个调用点（去掉字段会因多余属性而类型报错）。
   * 语义与护栏见 lib/pull-refresh-core.ts 文件头注释与 pull-refresh-core.test.ts。
   */
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
   *
   * v19-M5：语义化触觉 —— 触发时刻 light、数据返回 success（失败不加，避免"错也震一下"）。
   */
  const run = useCallback(() => {
    if (!enabled || refreshing) return;
    haptics.light();
    setRefreshing(true);
    void Promise.resolve()
      .then(() => onRefresh())
      .then(() => {
        haptics.success();
      })
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
