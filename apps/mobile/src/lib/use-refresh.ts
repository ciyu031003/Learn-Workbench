import { useCallback, useState } from "react";

/**
 * 下拉刷新状态：把「刷新中」的样板代码收敛到一处。
 * 用法：`const { refreshing, onRefresh } = useRefreshable(load);`
 * 然后给 ScrollView/FlatList 加 `refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} … />}`。
 */
export function useRefreshable(load: () => void | Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return { refreshing, onRefresh };
}
