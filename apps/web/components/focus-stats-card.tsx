"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, BarChart3, ListOrdered, Download, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyStats {
  date: string;
  todaySessions: number;
  todayMinutes: number;
  totalFocusDays: number;
  streak: number;
  last14: { date: string; minutes: number; sessions: number }[];
  todayList: { start_time: string; end_time: string; minutes: number }[];
}

const MOTIVATIONS = [
  "每天前进 1%，一年后你就是 37.8 倍的自己。",
  "专注 25 分钟，胜过心不在焉的两小时。",
  "把时间花在值得的地方，时间会替你说话。",
  "积累不是一蹴而就，而是日拱一卒的坚持。",
  "每一次专注，都是在为未来的自己投票。",
];

export function FocusStatsCard() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [view, setView] = useState<"dist" | "timeline">("dist");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/focus/daily");
      if (!r.ok) return;
      setStats((await r.json()) as DailyStats);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const exportPng = async () => {
    if (!stats) return;
    try {
      const W = 1000;
      const H = 1400;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 背景
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#fff7ed");
      bg.addColorStop(0.5, "#ffedd5");
      bg.addColorStop(1, "#fed7aa");
      ctx.fillStyle = bg;
      roundRect(ctx, 0, 0, W, H, 48);
      ctx.fill();

      // 头部
      ctx.fillStyle = "#1c1917";
      ctx.font = "700 64px 'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("专 注 打 卡", W / 2, 150);
      ctx.font = "400 34px 'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif";
      ctx.fillStyle = "#78716c";
      ctx.fillText(stats.date, W / 2, 212);

      // 4 个统计块
      const stats2 = [
        { label: "累计专注天数", value: `${stats.totalFocusDays}`, unit: "天" },
        { label: "连续专注天数", value: `${stats.streak}`, unit: "天" },
        { label: "今日专注次数", value: `${stats.todaySessions}`, unit: "次" },
        { label: "今日专注时长", value: `${stats.todayMinutes}`, unit: "分钟" },
      ];
      const bw = (W - 3 * 40 - 80) / 2;
      const bh = 190;
      stats2.forEach((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 40 + col * (bw + 40);
        const y = 280 + row * (bh + 32);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        roundRect(ctx, x, y, bw, bh, 28);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, bw, bh, 28);
        ctx.stroke();
        ctx.fillStyle = "#c2410c";
        ctx.font = "700 56px 'Noto Sans SC','PingFang SC',sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.value, x + bw / 2, y + 92);
        ctx.font = "400 26px 'Noto Sans SC','PingFang SC',sans-serif";
        ctx.fillStyle = "#57534e";
        ctx.fillText(s.label, x + bw / 2, y + 138);
        ctx.fillStyle = "#a8a29e";
        ctx.font = "400 22px 'Noto Sans SC','PingFang SC',sans-serif";
        ctx.fillText(s.unit, x + bw / 2 + 70, y + 92);
      });

      // 最近 14 天分布
      ctx.fillStyle = "#292524";
      ctx.font = "600 30px 'Noto Sans SC','PingFang SC',sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("近 14 天专注分布", 40, 760);
      const chartX = 40;
      const chartY = 980;
      const chartW = W - 80;
      const chartH = 220;
      const max = Math.max(1, ...stats.last14.map((d) => d.minutes));
      const step = chartW / 14;
      stats.last14.forEach((d, i) => {
        const h = (d.minutes / max) * chartH;
        const x = chartX + i * step + step * 0.18;
        const w = step * 0.64;
        const grad = ctx.createLinearGradient(0, chartY - h, 0, chartY);
        grad.addColorStop(0, "#ea580c");
        grad.addColorStop(1, "#fbbf24");
        ctx.fillStyle = grad;
        roundRect(ctx, x, chartY - h, w, h, 8);
        ctx.fill();
      });
      ctx.strokeStyle = "rgba(41,37,36,0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(chartX, chartY);
      ctx.lineTo(chartX + chartW, chartY);
      ctx.stroke();

      // 励志文案
      ctx.fillStyle = "#b45309";
      ctx.font = "500 30px 'Noto Sans SC','PingFang SC',sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(MOTIVATIONS[Math.min(stats.streak, MOTIVATIONS.length - 1)], W / 2, 1120);

      // 底部
      ctx.fillStyle = "#a8a29e";
      ctx.font = "400 24px 'Noto Sans SC','PingFang SC',sans-serif";
      ctx.fillText("学习工作台 · 用专注兑换成长", W / 2, 1310);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const file = new File([blob], `focus-card-${stats.date}.png`, { type: "image/png" });
      // 优先系统分享
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "专注打卡", text: `今日专注 ${stats.todayMinutes} 分钟` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `focus-card-${stats.date}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setMsg("打卡卡片已导出");
      }
    } catch {
      setMsg("分享失败，请重试");
    }
  };

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">加载专注统计…</CardContent>
      </Card>
    );
  }

  const maxMin = Math.max(1, ...stats.last14.map((d) => d.minutes));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-primary" />
          <CardTitle>专注打卡 · {stats.date}</CardTitle>
        </div>
        <Button variant="secondary" size="sm" onClick={exportPng}>
          <Share2 className="size-4" /> 分享打卡卡片
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {msg ? <Badge variant="success" className="self-start">{msg}</Badge> : null}

        {/* 核心数据 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "累计专注天数", value: stats.totalFocusDays, unit: "天" },
            { label: "连续专注天数", value: stats.streak, unit: "天" },
            { label: "今日专注次数", value: stats.todaySessions, unit: "次" },
            { label: "今日专注时长", value: stats.todayMinutes, unit: "分钟" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 text-center">
              <div className="text-2xl font-bold text-foreground">
                {s.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{s.unit}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 分布图 / 时间轴 切换 */}
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-white/20">
            <button
              onClick={() => setView("dist")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                view === "dist" ? "bg-primary/25 text-foreground" : "text-muted-foreground hover:bg-white/10"
              )}
            >
              <BarChart3 className="size-3.5" /> 分布图
            </button>
            <button
              onClick={() => setView("timeline")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                view === "timeline" ? "bg-primary/25 text-foreground" : "text-muted-foreground hover:bg-white/10"
              )}
            >
              <ListOrdered className="size-3.5" /> 时间轴
            </button>
          </div>
        </div>

        {view === "dist" ? (
          <div className="flex h-36 items-end gap-1.5 sm:h-44">
            {stats.last14.map((d) => (
              <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary to-amber-300 transition-all"
                    style={{ height: `${Math.max(3, (d.minutes / maxMin) * 100)}%` }}
                    title={`${d.date} · ${d.minutes} 分钟`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {stats.todayList.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">今天还没有专注记录</p>
            ) : (
              stats.todayList.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {s.start_time} – {s.end_time}
                  </span>
                  <span className="font-semibold">{s.minutes} 分钟</span>
                </div>
              ))
            )}
          </div>
        )}

        <p className="text-sm text-foreground/90">{MOTIVATIONS[Math.min(stats.streak, MOTIVATIONS.length - 1)]}</p>
        <Button variant="outline" size="sm" onClick={exportPng} className="self-start">
          <Download className="size-4" /> 导出 PNG 图片
        </Button>
      </CardContent>
    </Card>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
