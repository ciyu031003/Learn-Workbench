import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiUrl } from "@/config";
import { mergeSummaryMaps, monthWindowsBack } from "@/lib/nutrition-stats";
import { toDaySummaryMap, type DaySummaryRow } from "@/lib/nutrition-views";

/**
 * 近 N 个月（默认 6）的逐日汇总（v4 P4-c 的趋势面板数据层）。
 *
 * **取数取舍**：后端 `GET /api/nutrition/summary` 单次上限 31 天（`MAX_DAYS`），
 * 拿不到"近 6 个月"→ 拆成 6 个**自然月**窗口（`monthWindowsBack`）并发请求，
 * 总耗时≈单次请求；结果按日期合并成一张 map，供曲线 / 点阵 / Food Calendar 共享。
 *
 * 三条行为约束：
 *  1. **懒加载**：`visible` 为 false 时不发请求（面板没打开就不打扰网络）；
 *  2. **同窗口不重拉**：`loadedKey` 记住已成功加载的窗口，反复开关面板不会重复打 6 个请求；
 *  3. **失败可重试**：只要有一个月拿到数据就认为可用（部分月份缺数据也能看图），
 *     全部失败才进入失败态；`retry()` 供界面按钮调用。
 *
 * 放在 `lib/` 而不是组件里：与 `use-day-entries.ts` 一致 —— 数据获取逻辑集中在 lib，
 * 组件保持"纯展示"，也便于以后两端复用。
 */
export function useMonthSummaries({
  visible,
  headers,
  todayKey,
  months = 6,
}: {
  visible: boolean;
  headers: () => Record<string, string>;
  todayKey: string;
  months?: number;
}): {
  rows: Record<string, DaySummaryRow>;
  /** 当前窗口还没加载成功（界面显示骨架） */
  pending: boolean;
  failed: boolean;
  retry: () => void;
  /** 强制重新拉取（面板每次打开时调用，保证同一天内新增记录也能看到） */
  reload: () => void;
} {
  const windows = useMemo(() => monthWindowsBack(todayKey, months), [todayKey, months]);
  /**
   * 缓存键必须包含 `todayKey`：只按"首月~末月"作键时，**同一个月内**新增记录不会改变键，
   * 于是"打开面板 → 记一条 → 再打开"仍显示旧总量（审查发现）。
   * 加上今天日期后，跨天自动失效；同一天内的记录变更由 `reload()` 兜底。
   */
  const windowKey = `${windows[0]?.key ?? ""}~${windows[windows.length - 1]?.key ?? ""}@${todayKey}`;

  const [rows, setRows] = useState<Record<string, DaySummaryRow>>({});
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** 请求令牌：快速切换/重试时丢弃过期响应（旧响应不得覆盖新数据） */
  /**
   * 请求令牌只放 ref。旧实现把它放在 state 并让请求闭包与旧 state 比较，
   * 请求返回时令牌已经变化，结果会被自己丢弃，趋势面板永远停在骨架屏。
   */
  const requestSeq = useRef(0);
  const wasVisible = useRef(false);

  const load = useCallback(
    async (myToken: number) => {
      try {
        const results = await Promise.all(
          windows.map(async (w) => {
            try {
              const r = await fetch(`${getApiUrl()}/api/nutrition/summary?days=${w.days}&end=${w.end}`, {
                headers: headers(),
              });
              if (!r.ok) return null;
              const d = (await r.json()) as { summary?: unknown };
              return toDaySummaryMap(d.summary);
            } catch {
              return null;
            }
          })
        );
        if (myToken !== requestSeq.current) return;
        const merged = mergeSummaryMaps(results);
        // 空数组也是有效响应（用户当月可能没有记录），不能把它当成接口失败。
        const anyOk = results.some((result) => result !== null);
        setRows(merged);
        // 只有"至少一个月成功"才记已加载：全部失败时留空，下次打开面板会自动重试（审查发现）
        setFailed(!anyOk);
        if (anyOk) setLoadedKey(windowKey);
      } catch {
        if (myToken === requestSeq.current) setFailed(true);
      }
    },
    [headers, windowKey, windows]
  );

  useEffect(() => {
    const reopening = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!visible) return;
    if (!reopening && loadedKey === windowKey) return;
    const myToken = requestSeq.current + 1;
    requestSeq.current = myToken;
    void load(myToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, loadedKey, windowKey]);

  const retry = useCallback(() => {
    setFailed(false);
    const myToken = requestSeq.current + 1;
    requestSeq.current = myToken;
    void load(myToken);
  }, [load]);

  /** 面板重新打开时强制刷新（同一天内新增记录后也能看到最新数字） */
  const reload = useCallback(() => {
    setLoadedKey(null);
    setFailed(false);
  }, []);

  return { rows, pending: loadedKey !== windowKey && !failed, failed, retry, reload };
}
