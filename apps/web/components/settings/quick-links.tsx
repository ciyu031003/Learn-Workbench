"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  Dumbbell,
  FileText,
  Layers,
  Lock,
  Salad,
  Repeat,
  ShieldCheck,
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

const GROUPS: { label: string; entries: Entry[] }[] = [
  {
    label: "学习与数据",
    entries: [
      { href: "/career/domains", title: "领域管理", subtitle: "新建 / 归档 / 从模板创建学习领域", icon: Layers, color: "#8d7bd8" },
      { href: "/roadmap", title: "学习路线", subtitle: "阶段 · 主题 · 进度 · 导入 MD", icon: FileText, color: "#2f74c0" },
      { href: "/trackers", title: "领域记录", subtitle: "跑量 · 体重 · 通用计量", icon: BarChart3, color: "#3da35d" },
      { href: "/habits", title: "习惯打卡", subtitle: "连续天数 · 13 周热力图", icon: Repeat, color: "#e1781c" },
    ],
  },
  {
    label: "健康",
    entries: [
      { href: "/wellbeing/nutrition", title: "今日饮食", subtitle: "食物营养库搜索 · 按克录入 · 趋势", icon: Salad, color: "#2fb3a6" },
      { href: "/wellbeing/workout", title: "训练记录", subtitle: "动作库 · 组次重量 · 训练容量", icon: Dumbbell, color: "#e1781c" },
      { href: "/wellbeing", title: "健康与状态", subtitle: "状态分 · 饮水 · 休息 · 本周分布", icon: Bell, color: "#2f74c0" },
    ],
  },
  {
    label: "账号与安全",
    entries: [
      { href: "/settings#account", title: "账号与同步", subtitle: "登录 · 云端同步 · 数据备份", icon: ShieldCheck, color: "#2f74c0" },
      { href: "/privacy.html", title: "隐私与数据", subtitle: "数据只在本机与你的云端账号之间流转", icon: Lock, color: "#71717a" },
    ],
  },
];

/**
 * Web「设置」页的分组快捷入口（v8 P2）：
 * 与 APP「我的」页的 5 组卡片一致 —— 每行一个语义色图标 + 标题 + 副标题 + 箭头。
 */
export function QuickLinks() {
  return (
    <div className="flex flex-col gap-3">
      {GROUPS.map((g) => (
        <div key={g.label} className="flex flex-col gap-2">
          <SectionLabel>{g.label}</SectionLabel>
          <Card className="overflow-hidden border-white/20 bg-card/60 backdrop-blur-xl transition-shadow hover:shadow-[0_18px_45px_-30px_rgba(47,116,192,0.7)]">
            <CardContent className="p-0">
              {g.entries.map((e, i) => {
                const Icon = e.icon;
                return (
                  <Link
                    key={e.href + e.title}
                    href={e.href}
                    className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 ${
                      i === g.entries.length - 1 ? "" : "border-b border-border/40"
                    }`}
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: e.color + "22", color: e.color }}
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{e.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{e.subtitle}</span>
                    </span>
                    <span className="text-muted-foreground">›</span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
