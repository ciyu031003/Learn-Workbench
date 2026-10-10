"use client";

import { useEffect, useState } from "react";
import {
  LEARNING_POINT_STATES,
  LEARNING_POINT_STATE_LABEL,
  summarizePointStates,
  type LearningPointState,
  type PointStateResult,
} from "@/lib/learning-states";
import { RefreshCw } from "lucide-react";

export interface PointStatesView {
  status: "loading" | "ready" | "anon";
  points: Record<string, PointStateResult>;
}

/** 拉取当前课程的知识点五状态；未登录/失败一律退回 "anon"（不假装有进度）。 */
export function usePointStates(trackSlug: string | undefined): PointStatesView {
  const [view, setView] = useState<PointStatesView>({ status: "loading", points: {} });
  useEffect(() => {
    if (!trackSlug) {
      setView({ status: "anon", points: {} });
      return;
    }
    let alive = true;
    (async () => {
      try {
        const response = await fetch(`/api/learning/point-states?track=${encodeURIComponent(trackSlug)}`);
        if (!response.ok) {
          if (alive) setView({ status: "anon", points: {} });
          return;
        }
        const data = (await response.json()) as { points?: Record<string, PointStateResult> };
        if (!alive) return;
        setView({ status: "ready", points: data.points ?? {} });
      } catch {
        if (alive) setView({ status: "anon", points: {} });
      }
    })();
    return () => {
      alive = false;
    };
  }, [trackSlug]);
  return view;
}

/** 内容时效：返回已过期（stale_after < now）的知识点 key 集合。 */
export function useContentFreshness(trackSlug: string | undefined): Set<string> {
  const [stale, setStale] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!trackSlug) return;
    let alive = true;
    (async () => {
      try {
        const response = await fetch(`/api/learning/content-freshness?track=${encodeURIComponent(trackSlug)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { stale?: string[] };
        if (alive) setStale(new Set(data.stale ?? []));
      } catch {
        // 忽略：时效提示是辅助信息
      }
    })();
    return () => {
      alive = false;
    };
  }, [trackSlug]);
  return stale;
}

const DOT_COLOR: Record<LearningPointState, string> = {
  read: "bg-sky-500",
  practice: "bg-indigo-500",
  mastery: "bg-success",
  review: "bg-warning",
  apply: "bg-fuchsia-500",
};

/** 五个小圆点：亮 = 该状态达成。hover 显示中文名，避免图标语义不清。 */
export function StateDots({ state }: { state: PointStateResult | undefined }) {
  if (!state) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label="知识点状态">
      {LEARNING_POINT_STATES.map((key) => {
        const lit = state[key];
        return (
          <span
            key={key}
            title={`${LEARNING_POINT_STATE_LABEL[key]}${lit ? "（已达成）" : "（未达成）"}`}
            className={`size-1.5 rounded-full ${lit ? DOT_COLOR[key] : "bg-muted-foreground/25"}`}
          />
        );
      })}
    </span>
  );
}

/** 课程级五状态汇总：每个状态各点亮了多少知识点 + 全点亮数。 */
export function PointStateSummary({ points }: { points: Record<string, PointStateResult> }) {
  const total = Object.keys(points).length;
  if (total === 0) return null;
  const summary = summarizePointStates(points);
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 px-3 py-2 text-center sm:grid-cols-6">
      {LEARNING_POINT_STATES.map((key) => (
        <div key={key}>
          <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <span className={`size-1.5 rounded-full ${DOT_COLOR[key]}`} />
            {LEARNING_POINT_STATE_LABEL[key]}
          </dt>
          <dd className="text-sm font-semibold tabular-nums">{summary.byState[key]}</dd>
        </div>
      ))}
      <div>
        <dt className="text-xs text-muted-foreground">全达成</dt>
        <dd className="text-sm font-semibold tabular-nums">{summary.complete}</dd>
      </div>
    </dl>
  );
}

/** 内容时效提示（阶段 14）：只在知识点确实过期时出现。 */
export function FreshnessBadge({ stale }: { stale: boolean }) {
  if (!stale) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning"
      title="该知识点距上次内容复核已超过周期，建议对照来源核实是否仍然准确"
    >
      <RefreshCw className="size-3" /> 内容待复核
    </span>
  );
}
