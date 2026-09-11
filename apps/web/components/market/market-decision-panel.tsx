"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRightLeft,
  Flame,
  Loader2,
  MapPin,
  Sparkles,
  Target,
} from "lucide-react";
import type { MarketIntelligencePayload } from "@/lib/domains/market/intelligence";
import type { MarketDecisionPayload } from "@/lib/domains/market/decision";

function compact(value: string) {
  return value.trim().slice(0, 120);
}

export function MarketDecisionPanel({
  facets,
  initialCity,
  initialFunction,
}: {
  facets?: MarketIntelligencePayload["facets"];
  initialCity?: string;
  initialFunction?: string;
}) {
  const [city, setCity] = useState(initialCity ?? "");
  const [functionKey, setFunctionKey] = useState(initialFunction ?? "");
  const [data, setData] = useState<MarketDecisionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (functionKey) params.set("function", functionKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this is the query loading state.
    setLoading(true);
    fetch(`/api/market/decision?${params.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error("决策加载失败");
        return response.json();
      })
      .then((payload: MarketDecisionPayload) => {
        if (alive) setData(payload);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [city, functionKey]);

  const moveList = (items: MarketDecisionPayload["hotspots"], limit = 4) =>
    items.slice(0, limit).map((item) => (
      <div key={`${item.reason}-${item.key}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-muted/20 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-foreground">{item.label}</p>
          <p className="text-[10px] text-muted-foreground">{item.reason} · {item.count} 岗{item.medianSalary != null ? ` · ${item.medianSalary}K` : ""}</p>
        </div>
        <Badge variant="muted" className="shrink-0 text-[10px]">{Math.round(item.score)}</Badge>
      </div>
    ));

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="flex-row items-center gap-2">
        <Target className="size-4 text-emerald-400" />
        <CardTitle className="text-sm">What If 决策引擎</CardTitle>
        <Badge variant="muted" className="ml-auto text-[10px]">参考建议</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
            目标城市
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="h-9 rounded-xl border border-border bg-surface px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              <option value="">热门默认</option>
              {(facets?.cities ?? []).slice(0, 12).map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
            目标职能
            <select
              value={functionKey}
              onChange={(event) => setFunctionKey(event.target.value)}
              className="h-9 rounded-xl border border-border bg-surface px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              <option value="">热门默认</option>
              {(facets?.functions ?? []).slice(0, 12).map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在计算迁移与热点
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-white/10 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            暂无决策数据
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground">目标岗位</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{data.scenario.totalJobs}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground">薪资中位</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{data.scenario.medianSalary != null ? `${data.scenario.medianSalary}K` : "--"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground">可触达</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{data.scenario.reachableJobs ?? "--"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground">待补技能</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{data.scenario.missingSkills.length}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {data.scenario.suggestions.map((suggestion) => (
                <p key={compact(suggestion)} className="text-xs text-muted-foreground">
                  <Sparkles className="mr-1 inline size-3 text-amber-500" />
                  {suggestion}
                </p>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Flame className="size-3.5 text-orange-400" />
                  热度
                </div>
                {moveList(data.hotspots)}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <MapPin className="size-3.5 text-sky-400" />
                  城市迁移
                </div>
                {moveList(data.migrations)}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <ArrowRightLeft className="size-3.5 text-emerald-400" />
                  升温预警
                </div>
                {moveList(data.alerts)}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
