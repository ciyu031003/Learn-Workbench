"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToastStore } from "@/store/toast-store";
import {
  Loader2,
  LogIn,
  PlusCircle,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import type {
  MarketPersonalInsights,
  MarketPersonalJob,
} from "@/lib/domains/market/personal";
import type { MarketGapItem } from "@learn-workbench/shared";

function MatchJobRow({ job }: { job: MarketPersonalJob }) {
  const tone =
    job.match >= 70 ? "text-success" : job.match >= 45 ? "text-primary" : "text-muted-foreground";
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group flex flex-col gap-2 rounded-xl border border-white/10 bg-muted/20 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">{job.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {job.company} · {job.city} {job.salaryText ? `· ${job.salaryText}` : ""}
          </p>
        </div>
        <span className={`shrink-0 text-right text-sm font-black tabular-nums ${tone}`}>{job.match}%</span>
      </div>
      {job.matchedSkills.length ? (
        <div className="flex flex-wrap gap-1">
          {job.matchedSkills.slice(0, 4).map((skill) => (
            <Badge key={skill} variant="muted" className="text-[10px]">{skill}</Badge>
          ))}
        </div>
      ) : null}
      {job.missingSkills.length ? (
        <p className="text-[10px] text-muted-foreground">
          <Target className="mr-1 inline size-3 text-amber-500" />
          还缺 {job.missingSkills.slice(0, 4).join(" / ")}
        </p>
      ) : null}
    </Link>
  );
}

function GapRow({
  gap,
  enrolling,
  onEnroll,
}: {
  gap: MarketGapItem;
  enrolling: boolean;
  onEnroll: (gap: MarketGapItem) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-muted/20 px-3 py-2.5">
      <Target className="size-3.5 shrink-0 text-primary" />
      <span className="min-w-0 text-xs font-semibold text-foreground">{gap.skill}</span>
      <Badge variant="muted" className="text-[10px]">{gap.jobCount} 岗位</Badge>
      {gap.topicTitle ? (
        <Link
          href={gap.phaseId ? `/roadmap#phase-${gap.phaseId}` : "/roadmap"}
          className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground hover:text-primary hover:underline"
        >
          {gap.topicTitle}{gap.estimateHours ? ` · ${gap.estimateHours}h` : ""}
        </Link>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onEnroll(gap)}
        disabled={enrolling || !gap.enrollable}
      >
        {enrolling ? <Loader2 className="size-3.5 animate-spin" /> : <PlusCircle className="size-3.5" />}
        补
      </Button>
    </div>
  );
}

export function PersonalMarketCard() {
  const pushToast = useToastStore((state) => state.push);
  const [data, setData] = useState<MarketPersonalInsights | { loggedIn: false } | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/market/personal")
      .then((response) => (response.ok ? response.json() : { loggedIn: false }))
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch(() => {
        if (alive) setData({ loggedIn: false });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const enroll = async (gap: MarketGapItem) => {
    setEnrolling(gap.skillId);
    try {
      const response = await fetch("/api/jobs/gaps/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gaps: [{ skill: gap.skill, topicId: gap.topicId, hours: gap.estimateHours }],
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "加入失败");
      pushToast(`已加入「${gap.skill}」学习任务`, "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "加入失败", "error");
    } finally {
      setEnrolling(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          正在计算你的市场位置
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.loggedIn) {
    return (
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <UserRound className="size-4 text-primary" />
          <CardTitle>我的市场位置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">登录后查看技能覆盖、可触达岗位和推荐职位。</p>
          <Button asChild size="sm" variant="secondary">
            <Link href="/login">
              <LogIn className="size-3.5" />
              去登录
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const profile = data.profile;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" />
          我的市场位置
        </CardTitle>
        <Badge variant="muted" className="text-[10px]">
          {profile.profileSkillCount}/{profile.marketSkillCount} 技能覆盖
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-muted/20 p-3">
            <p className="text-[10px] text-muted-foreground">技能覆盖率</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{profile.skillCoveragePct}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-muted/20 p-3">
            <p className="text-[10px] text-muted-foreground">可触达岗位</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{data.reachableJobs}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-muted/20 p-3">
            <p className="text-[10px] text-muted-foreground">市场缺口</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{data.gaps.length}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <TrendingUp className="size-3.5 text-amber-500" />
            优先补什么
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {data.gaps.length ? (
              data.gaps.slice(0, 5).map((gap) => (
                <GapRow
                  key={gap.skillId}
                  gap={gap}
                  enrolling={enrolling === gap.skillId}
                  onEnroll={enroll}
                />
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                你的技能已经覆盖当前市场主要需求。
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Target className="size-3.5 text-primary" />
            推荐岗位
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
            {data.recommendations.length ? (
              data.recommendations.slice(0, 6).map((job) => <MatchJobRow key={job.id} job={job} />)
            ) : (
              <p className="rounded-xl border border-white/10 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                暂未找到与你技能匹配的职位，先补齐上面的技能会更好命中。
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
