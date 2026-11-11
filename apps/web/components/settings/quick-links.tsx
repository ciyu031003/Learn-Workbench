"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  Dumbbell,
  FileText,
  Layers,
  Repeat,
  Salad,
} from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { Card, CardContent } from "@/components/ui/card";

interface Entry {
  href: string;
  title: string;
  subtitle: string;
  icon: typeof Layers;
  color: string;
}

const ENTRIES: Entry[] = [
  { href: "/career/domains", title: "领域管理", subtitle: "新建 / 归档 / 从模板创建", icon: Layers, color: "#8d7bd8" },
  { href: "/roadmap", title: "学习路线", subtitle: "阶段 · 主题 · 进度 · 导入 MD", icon: FileText, color: "#2f74c0" },
  { href: "/habits", title: "习惯打卡", subtitle: "连续天数 · 14 周热力图", icon: Repeat, color: "#e1781c" },
  { href: "/trackers", title: "领域记录", subtitle: "跑量 · 体重 · 通用计量", icon: BarChart3, color: "#3da35d" },
  { href: "/wellbeing/nutrition", title: "今日饮食", subtitle: "食物库搜索 · 按克录入", icon: Salad, color: "#2fb3a6" },
  { href: "/wellbeing/workout", title: "训练记录", subtitle: "动作库 · 组次重量 · 训练量", icon: Dumbbell, color: "#e1781c" },
  { href: "/wellbeing", title: "健康与状态", subtitle: "状态分 · 饮水 · 休息", icon: Bell, color: "#2f74c0" },
];

/** Web「设置」页的快捷入口：只放工具入口，账号与同步由上方账号卡承担，避免重复。 */
export function QuickLinks() {
  return (
    <section className="flex flex-col gap-2.5">
      <SectionLabel>快捷入口</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        {ENTRIES.map((entry) => (
          <Card key={entry.href + entry.title} className="border-border-button-default bg-surface">
            <CardContent className="p-0">
              <Link
                href={entry.href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background-secondary-hover"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: entry.color + "22", color: entry.color }}
                >
                  <entry.icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text-primary">{entry.title}</span>
                  <span className="block truncate text-caption-1-medium text-text-secondary">{entry.subtitle}</span>
                </span>
                <span className="text-text-tertiary" aria-hidden>›</span>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
