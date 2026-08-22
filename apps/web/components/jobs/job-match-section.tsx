"use client";

import { useEffect, useState } from "react";
import type { JobMatchResult, SkillGapsResult } from "@learn-workbench/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import { Loader2, Sparkles, TrendingUp, CheckCircle2, AlertCircle, PlusCircle } from "lucide-react";

/**
 * P2 · 岗位匹配度 + 能力缺口（职位详情内展示）
 * - 匹配度：规则版公式（技能 70% + 学历 10% + 经验 10% + 城市 10%）
 * - 缺口：岗位技能 - 用户技能，可一键加入学习路线
 */
export function JobMatchSection({ jobId }: { jobId: number }) {
  const pushToast = useToastStore((s) => s.push);
  const [match, setMatch] = useState<JobMatchResult | null>(null);
  const [gaps, setGaps] = useState<SkillGapsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
// eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/jobs/${jobId}/match`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/jobs/${jobId}/gaps`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([m, g]) => {
        if (!alive) return;
        setMatch(m?.match ?? null);
        setGaps(g ?? null);
      })
      .catch(() => { if (alive) setError("匹配度加载失败"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [jobId]);

  const enroll = async () => {
    if (!gaps || gaps.gaps.length === 0) return;
    setEnrolling(true);
    try {
      const r = await fetch("/api/jobs/gaps/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gaps: gaps.gaps.map((g) => ({ skill: g.skill, topicId: g.topicId, hours: g.estimateHours })),
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "加入失败");
      pushToast(`已加入 ${d.created ?? 0} 项学习任务到今日计划`, "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "加入失败", "error");
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> 正在计算匹配度…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Sparkles className="size-4 text-primary" />
          我的匹配度
        </h3>
        {match ? (
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-sm font-black tabular-nums",
            match.overall >= 80 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              : match.overall >= 60 ? "bg-sky-500/15 text-sky-600 dark:text-sky-300"
              : match.overall >= 40 ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
              : "bg-rose-500/15 text-rose-500 dark:text-rose-300"
          )}>
            {match.overall}%
          </span>
        ) : null}
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {match && !match.hasUserProfile ? (
        <p className="rounded-xl border border-white/15 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          登录并完善技能画像后，这里会显示你的岗位匹配度与能力缺口（当前为匿名模式）。
        </p>
      ) : null}

      {match && match.matchedSkills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {match.matchedSkills.map((s) => (
            <span key={s.skill} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="size-3" />
              {s.skill}{s.partial ? "（部分）" : ""}
            </span>
          ))}
        </div>
      ) : null}

      {gaps && gaps.gaps.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <AlertCircle className="size-3.5 text-amber-500" />
            你还缺少 {gaps.gaps.length} 项技能
            {gaps.totalHours > 0 ? <span className="font-normal text-muted-foreground">· 预计学习 {gaps.totalHours} 小时</span> : null}
          </div>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {gaps.gaps.map((g) => (
              <li key={g.skill} className="flex items-center gap-1.5">
                <TrendingUp className="size-3 text-amber-500" />
                <span className="font-semibold text-foreground">{g.skill}</span>
                {g.topicTitle ? <span>→ {g.topicTitle}</span> : null}
                {g.estimateHours ? <span>（约 {g.estimateHours}h）</span> : null}
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" onClick={enroll} disabled={enrolling} className="self-start">
            {enrolling ? <Loader2 className="size-3.5 animate-spin" /> : <PlusCircle className="size-3.5" />}
            缺口加入我的学习路线
          </Button>
        </div>
      ) : null}

      {match && match.missingSkills.length === 0 && match.hasUserProfile ? (
        <p className="text-xs text-success">技能已全部覆盖该岗位要求 🎉</p>
      ) : null}
    </div>
  );
}
