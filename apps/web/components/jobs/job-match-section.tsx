"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobLearningPlan, JobMatchResult, SkillGapsResult } from "@learn-workbench/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import { Loader2, Sparkles, TrendingUp, CheckCircle2, AlertCircle, PlusCircle, MapPin, CalendarClock, ListChecks } from "lucide-react";

/**
 * 岗位匹配度 + 能力缺口 + 岗位学习计划（整包规划，职位详情内展示）
 * - 匹配度：规则版公式（技能 70% + 学历 10% + 经验 10% + 城市 10%）
 * - 缺口：岗位技能 - 用户技能，可一键加入学习路线
 * - 学习计划：缺口按路线图阶段分组（顺序=学习顺序），链接定位 roadmap#phase-<id>
 */
export function JobMatchSection({ jobId }: { jobId: number }) {
  const pushToast = useToastStore((s) => s.push);
  const [match, setMatch] = useState<JobMatchResult | null>(null);
  const [gaps, setGaps] = useState<SkillGapsResult | null>(null);
  const [plan, setPlan] = useState<JobLearningPlan | null>(null);
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
      fetch(`/api/jobs/${jobId}/plan`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([m, g, p]) => {
        if (!alive) return;
        setMatch(m?.match ?? null);
        setGaps(g ?? null);
        setPlan(p ?? null);
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
        <Loader2 className="size-4 animate-spin" /> 正在计算匹配度与学习计划…
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
          登录并完善技能画像后，这里会显示你的岗位匹配度、能力缺口与学习计划（当前为匿名模式）。
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
        </div>
      ) : null}

      {/* 岗位学习计划（整包规划） */}
      {plan && plan.gaps.length > 0 ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3">
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <ListChecks className="size-4 text-primary" />
            岗位学习计划
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              补完约 +{Math.max(0, 100 - plan.match)}% 匹配度
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" /> 共 {plan.gaps.length} 项缺口</span>
            <span>· 约 {plan.totalHours} 小时</span>
            {plan.estimatedWeeks > 0 ? <span>· 每周 10h 约 {plan.estimatedWeeks} 周</span> : null}
          </p>
          <div className="flex flex-col gap-2">
            {plan.phases.map((ph) => (
              <div key={ph.phaseId ?? "other"} className="rounded-lg border border-white/10 bg-muted/20 px-2.5 py-2">
                <Link
                  href={ph.phaseId ? `/roadmap#phase-${ph.phaseId}` : "/roadmap"}
                  className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-foreground hover:text-primary hover:underline"
                >
                  <span className="flex items-center gap-1.5">
                    {ph.phaseId ? <MapPin className="size-3 text-primary" /> : <Sparkles className="size-3 text-primary" />}
                    {ph.phaseId ? `${(ph.phaseKey ?? "").replace("phase-", "P")} · ${ph.phaseTitle ?? "阶段"}` : "其他学习内容"}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{ph.hours}h</span>
                </Link>
                <ul className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                  {ph.skills.map((g) => (
                    <li key={g.skill} className="flex items-center gap-1">
                      <span className="font-medium text-foreground">{g.skill}</span>
                      {g.topicTitle ? <span>→ {g.topicTitle}</span> : null}
                      {g.estimateHours ? <span>（{g.estimateHours}h）</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={enroll} disabled={enrolling} className="self-start">
            {enrolling ? <Loader2 className="size-3.5 animate-spin" /> : <PlusCircle className="size-3.5" />}
            全部缺口加入学习路线
          </Button>
        </div>
      ) : null}

      {match && match.missingSkills.length === 0 && match.hasUserProfile ? (
        <p className="text-xs text-success">技能已全部覆盖该岗位要求 🎉</p>
      ) : null}
    </div>
  );
}
