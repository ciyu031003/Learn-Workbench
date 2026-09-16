import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/config";
import type { MealEntry } from "@learn-workbench/shared";
import { planDayEntryFetches } from "@/lib/nutrition-stats";

/**
 * 按天补拉饮食明细（v4 P4-c：Food Calendar 的食物缩略图需要"每天吃了什么"）。
 *
 * 为什么要这个 hook：后端只有**单日**查询（`GET /api/nutrition?date=`），
 * 而缩略图要覆盖整月，所以必须按天补拉。三条约束：
 *  1. **只拉有记录的天**（调用方从 summary 里筛出来），通常一个月也就几天到十几天；
 *  2. **并发上限 4**，避免一次打出几十个请求把弱网打满；
 *  3. **进程内缓存**：已经拉过的日期不再重复请求（翻月来回切是常见操作）。
 *
 * 失败按"空"处理并记入已拉取集合 —— 离线时不该反复重试（下次打开面板会重新挂载重来）。
 */
export function useDayEntries({
  /** 需要明细的日期（新→旧；调用方已按"有记录"筛过并截断） */
  dates,
  /** 鉴权头工厂（与页面其它请求同源，匿名时返回空对象） */
  headers,
  /** 弹层打开时才为 true，关闭时不发请求 */
  enabled,
  /** 单批最多拉几天（兜住"整月都有记录"的最坏情况） */
  cap = 24,
}: {
  dates: string[];
  headers: () => Record<string, string>;
  enabled: boolean;
  cap?: number;
}) {
  const [entries, setEntries] = useState<Record<string, MealEntry[]>>({});
  const [loading, setLoading] = useState(false);
  /** 已请求过的日期（只在 effect 内读写，避免渲染期访问 ref） */
  const fetched = useRef<Set<string>>(new Set());

  /** 用字符串做依赖：`dates` 每次渲染都是新数组，直接当依赖会无限触发 */
  const wantedKey = dates.join("|");

  useEffect(() => {
    /**
     * 全部逻辑放进 async IIFE：effect 体内不直接 setState（否则触发
     * `react-hooks/set-state-in-effect` 级联渲染告警）。
     * 早退分支也必须收尾 —— 否则"上一批在飞被打断 + 新一批 plan 为空"会让 loading 永久停在 true，
     * 界面一直显示"缩略图加载中…"（审查发现）。
     */
    let alive = true;
    void (async () => {
      if (!enabled || !wantedKey) {
        if (alive) setLoading(false);
        return;
      }
      const wanted = wantedKey.split("|");
      const plan = planDayEntryFetches([...fetched.current], wanted, cap);
      if (plan.length === 0) {
        if (alive) setLoading(false);
        return;
      }
      setLoading(true);
      const results: Record<string, MealEntry[]> = {};
      /** 失败的日期不进缓存：否则离线时打开一次面板，整个会话都不再补拉（审查发现） */
      const failed: string[] = [];
      let cursor = 0;
      const worker = async () => {
        while (cursor < plan.length) {
          const key = plan[cursor];
          cursor += 1;
          try {
            const r = await fetch(`${getApiUrl()}/api/nutrition?date=${key}`, { headers: headers() });
            if (!r.ok) {
              failed.push(key);
              continue;
            }
            const d = (await r.json()) as { entries?: MealEntry[] } | null;
            results[key] = Array.isArray(d?.entries) ? d.entries : [];
          } catch {
            // 离线 / 服务端错误：失败日期不标记已拉取，等下次打开面板再试
            failed.push(key);
          }
        }
      };
      // 并发上限 4：cursor 是共享游标，四个 worker 各自取任务
      await Promise.all([0, 1, 2, 3].map(worker));
      if (!alive) return;
      // 成功的日期标记为已拉取（失败的留待下次）
      for (const key of plan) {
        if (!failed.includes(key)) fetched.current.add(key);
      }
      setEntries((prev) => ({ ...prev, ...results }));
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [wantedKey, enabled, headers, cap]);

  return { entries, loading };
}
