"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MarketGapItem } from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Target } from "lucide-react";

/** 局部样式（不动 globals.css） */
const STYLES = `
@keyframes dgc-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(47, 116, 192, 0.35); }
  70%  { box-shadow: 0 0 0 9px rgba(47, 116, 192, 0); }
  100% { box-shadow: 0 0 0 0 rgba(47, 116, 192, 0); }
}
.dgc-chip { animation: dgc-pulse 2.6s ease-out infinite; }
.dgc-row { transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease; }
.dgc-row:hover { transform: translateX(2px); }
.dgc-fill { height: 100%; border-radius: 999px; transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
.dgc-cta { transition: transform 0.2s ease; }
.group:hover .dgc-cta { transform: translateX(3px); }
@media (prefers-reduced-motion: reduce) {
  .dgc-chip { animation: none; }
  .dgc-fill { transition: none; }
  .dgc-row:hover { transform: none; }
  .group:hover .dgc-cta { transform: none; }
}
`;

/** Dashboard 入口卡：市场需要、我还缺的技能 TOP3，点击进入技能树补齐（无数据/未登录时不渲染） */
export function DashboardGapCard() {
  const [gaps, setGaps] = useState<MarketGapItem[] | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/skills/gaps?limit=3")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setGaps(d?.gaps ?? []); })
      .catch(() => { if (alive) setGaps([]); });
    return () => { alive = false; };
  }, []);

  // 首帧宽度为 0，下一帧再展开 → 得到"需求条生长"的入场动效
  useEffect(() => {
    if (!gaps || gaps.length === 0) return;
    const t = setTimeout(() => setFilled(true), 60);
    return () => clearTimeout(t);
  }, [gaps]);

  if (gaps === null || gaps.length === 0) return null;
  const max = Math.max(...gaps.map((g) => g.jobCount), 1);

  return (
    <Link href="/career/skills" className="group block">
      <style>{STYLES}</style>
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="icon-chip dgc-chip h-10 w-10 shrink-0">
              <Target className="size-5 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">市场需要、你还缺 {gaps.length} 项技能</p>
              <p className="mt-0.5 text-xs text-muted-foreground">按岗位需求量排序 · 补齐即可提升匹配度</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-primary">
              去补齐
              <ArrowRight className="dgc-cta size-3.5" />
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {gaps.map((g, i) => (
              <li key={g.skillId} className="dgc-row flex items-center gap-2.5">
                <span className="w-24 shrink-0 truncate text-xs font-semibold" title={g.skill}>{g.skill}</span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="dgc-fill block bg-gradient-to-r from-primary to-emerald-500"
                    style={{ width: filled ? `${Math.max(12, Math.round((g.jobCount / max) * 100))}%` : "0%", transitionDelay: `${i * 90}ms` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right text-[11px] font-bold tabular-nums text-muted-foreground">{g.jobCount} 岗</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Link>
  );
}
