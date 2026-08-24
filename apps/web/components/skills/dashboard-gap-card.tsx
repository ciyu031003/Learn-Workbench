"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MarketGapItem } from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

/** Dashboard 入口卡：市场需要、我还缺的技能 TOP3，点击进入技能树补齐（无数据/未登录时不渲染） */
export function DashboardGapCard() {
  const [gaps, setGaps] = useState<MarketGapItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/skills/gaps?limit=3")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setGaps(d?.gaps ?? []); })
      .catch(() => { if (alive) setGaps([]); });
    return () => { alive = false; };
  }, []);

  if (gaps === null || gaps.length === 0) return null;

  return (
    <Link href="/career/skills" className="group block">
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <span className="icon-chip h-10 w-10 shrink-0">
            <Target className="size-5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">市场需要、你还缺 {gaps.length} 项技能</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {gaps.map((g) => (
                <Badge key={g.skillId} variant="muted" className="text-[10px]">
                  {g.skill} · {g.jobCount} 岗
                </Badge>
              ))}
            </div>
          </div>
          <span className="shrink-0 text-xs font-medium text-primary group-hover:underline">去补齐 →</span>
        </CardContent>
      </Card>
    </Link>
  );
}
