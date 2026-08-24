"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MarketGapItem, MarketGapsResult } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToastStore } from "@/store/toast-store";
import { Loader2, TrendingUp, CheckCircle2, PlusCircle, Target, Sparkles, MapPin } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  backend: "后端", frontend: "前端", data: "数据", ops: "运维/云",
  ai: "AI", network: "网络", security: "安全", cloud: "云计算", soft: "软技能", "": "其他",
};
const LEVEL_LABELS = ["未掌握", "了解", "入门", "熟练", "精通", "专家"];

/** 学习 × 招聘打通：市场高频需求 × 我的能力缺口（聚合视图，技能树页） */
export function MarketGapsCard({ limit = 10 }: { limit?: number }) {
  const pushToast = useToastStore((s) => s.push);
  const [data, setData] = useState<MarketGapsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/skills/gaps?limit=${limit}`);
      if (!r.ok) throw new Error("加载失败");
      setData(await r.json());
      setError(null);
    } catch {
      setError("市场需求缺口加载失败");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
  useEffect(() => { load(); }, [load]);

  const enroll = async (g: MarketGapItem) => {
    setEnrolling(g.skillId);
    try {
      const r = await fetch("/api/jobs/gaps/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gaps: [{ skill: g.skill, topicId: g.topicId, hours: g.estimateHours }] }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "加入失败");
      pushToast(`已加入「${g.skill}」学习任务到今日计划`, "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "加入失败", "error");
    } finally {
      setEnrolling(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" /> 市场需求缺口
        </CardTitle>
        {data ? <Badge variant="muted">{data.totalJobs} 个在招岗位统计</Badge> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 正在分析市场需求…
          </p>
        ) : error ? (
          <p className="py-4 text-sm text-danger">{error}</p>
        ) : !data || data.gaps.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-sm text-success">
            <CheckCircle2 className="size-4" /> 技能已覆盖市场高频需求 🎉 继续巩固即可
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              <Sparkles className="mr-1 inline size-3.5 text-amber-500" />
              市场要求最多、你还未达标的技能 —— 补齐即可直接提升岗位匹配度
            </p>
            {data.gaps.map((g) => (
              <div key={g.skillId} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-muted/30 px-3 py-2.5">
                <Target className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 text-sm font-semibold">{g.skill}</span>
                <Badge variant="muted" className="text-[10px]">{CATEGORY_LABELS[g.category] ?? "其他"}</Badge>
                <span className="text-xs text-muted-foreground">{g.jobCount} 岗位要求 · 我：{LEVEL_LABELS[g.myLevel]}</span>
                {g.topicTitle ? (
                  <Link
                    href={g.phaseId ? `/roadmap#phase-${g.phaseId}` : "/roadmap"}
                    title={g.phaseTitle ? `定位到路线图阶段：${g.phaseTitle}` : "前往学习路线图"}
                    className="w-full text-xs text-muted-foreground hover:text-primary hover:underline sm:w-auto sm:flex-1 sm:truncate"
                  >
                    → {g.topicTitle}{g.estimateHours ? `（约 ${g.estimateHours}h）` : ""}
                    {g.phaseId ? <MapPin className="ml-1 inline size-3" /> : null}
                  </Link>
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => enroll(g)} disabled={enrolling === g.skillId} className="ml-auto">
                  {enrolling === g.skillId ? <Loader2 className="size-3.5 animate-spin" /> : <PlusCircle className="size-3.5" />}
                  加入学习
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
