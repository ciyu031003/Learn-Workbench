"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeartPulse, Droplets, Coffee } from "lucide-react";
import type { WellbeingToday } from "@learn-workbench/shared";

/**
 * 健康提醒 · 系统级浮层（2.0：wellbeing 不再占一级导航）
 * 数据来自 /api/wellbeing/today，仅在需要提醒时出现（久坐 / 饮水 / 休息），点击进入 wellbeing 页。
 */
export function WellbeingFloat() {
  const [today, setToday] = useState<WellbeingToday | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/wellbeing/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setToday(d);
        // 有到期提醒或建议休息时才显示浮层；否则静默
        const needs = (d.remindersDue?.length ?? 0) > 0 || d.nextBreakDue === true;
        setVisible(needs);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!visible || !today) return null;

  const reminder = today.remindersDue?.[0];
  const label = reminder?.title
    ?? (today.nextBreakDue ? "建议起来活动一下" : null)
    ?? "今日健康";

  return (
    <Link
      href="/wellbeing"
      className="glass-nav fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium text-foreground shadow-lg transition-transform hover:scale-105 md:bottom-6 md:right-6"
      aria-label="健康提醒"
    >
      {reminder?.type === "HYDRATION" || !reminder ? <Droplets className="size-4 text-accent" /> : <HeartPulse className="size-4 text-success" />}
      <span>{label}</span>
      <Coffee className="size-3.5 text-muted-foreground" />
    </Link>
  );
}
