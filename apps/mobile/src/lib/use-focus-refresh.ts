import { useCallback } from "react";
import { useFocusEffect } from "expo-router";

/**
 * 页面获得焦点时执行一次回调（含首次进入）。
 * 用途：Tab 切换回来时刷新首页/列表数据，避免看到过期状态。
 * 注意：`cb` 需用 useCallback 包裹，否则每次渲染都会重新订阅。
 */
export function useFocusRefresh(cb: () => void | Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      void cb();
    }, [cb])
  );
}
