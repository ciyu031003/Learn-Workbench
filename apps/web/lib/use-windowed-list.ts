"use client";

import { useCallback, useMemo, useState } from "react";
import { DEFAULT_BATCH_SIZE, clampWindow, hasMore, nextWindowSize, visibleSlice } from "./windowed-list";

export interface WindowedListOptions {
  /** 每次加载条数，默认 30 */
  batch?: number;
  /** 变化时把窗口重置回第一页（筛选条件、状态筛选等） */
  resetKey?: string | number;
}

export interface WindowedListResult<T> {
  /** 当前窗口内条目 */
  visible: T[];
  /** 当前窗口大小 */
  shown: number;
  /** 总条数 */
  total: number;
  /** 是否还有更多 */
  hasMore: boolean;
  /** 加载下一页 */
  loadMore: () => void;
  /** 手动重置到第一页 */
  reset: () => void;
}

/**
 * 增量窗口化 hook（S3-8）：不引入虚拟化依赖，只控制"渲染多少条"。
 *
 * - 首次渲染 batch 条；`loadMore` 每次 +batch；
 * - `resetKey` 变化时在渲染期把窗口调回第一页（React 官方 props→state 模式，无级联 effect）；
 * - 数据变短时自动夹紧窗口（不会出现"加载更多后空白"）。
 */
export function useWindowedList<T>(items: readonly T[], options: WindowedListOptions = {}): WindowedListResult<T> {
  const batch = options.batch && options.batch > 0 ? Math.floor(options.batch) : DEFAULT_BATCH_SIZE;
  const resetKey = options.resetKey;
  const [shown, setShown] = useState(batch);
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  // 渲染期调整（React 官方 props→state 模式，同 ui/modal.tsx），避免 effect 内 setState 造成二次渲染
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setShown(batch);
  }

  const total = items.length;
  const effectiveShown = clampWindow(shown, total);

  const visible = useMemo(() => visibleSlice(items, effectiveShown), [items, effectiveShown]);

  const loadMore = useCallback(() => {
    setShown((current) => nextWindowSize(clampWindow(current, items.length) || current, items.length, batch));
  }, [batch, items.length]);

  const reset = useCallback(() => setShown(batch), [batch]);

  return {
    visible,
    shown: effectiveShown,
    total,
    hasMore: hasMore(effectiveShown, total),
    loadMore,
    reset,
  };
}
