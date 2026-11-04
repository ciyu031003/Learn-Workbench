"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LogEntry } from "@learn-workbench/shared/schemas";
import { logKindLabels } from "@learn-workbench/shared/labels";
import { todayISOInZone } from "@learn-workbench/shared/domains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { Download, Plus, NotebookPen, ArrowRight, PenLine } from "lucide-react";
import Link from "next/link";
import { DomainIcon } from "@/components/domain-icon";
import { LogsList } from "@/components/logs/logs-list";
import { useDomainStore } from "@/store/domain-store";

const KINDS = ["feynman", "review", "project", "interview"] as const;

export default function LogsPage() {
  const domain = useDomainStore((s) => s.current);
  const careerKey = domain?.careerKey ?? "ict";
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("feynman");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/logs?limit=200&career=${careerKey}`);
    const data = await r.json();
    setLogs(data.logs ?? []);
  }, [careerKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addLog = async () => {
    if (!title.trim() || !content.trim()) return;
    const r = await fetch("/api/logs", {
      method: "POST",
      body: JSON.stringify({ kind, career: careerKey, title: title.trim(), content: content.trim() }),
    });
    if (r.ok) {
      setTitle("");
      setContent("");
      load();
    }
  };

  const exportJson = async () => {
    const r = await fetch("/api/export");
    const data = await r.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `learn-workbench-export-${todayISOInZone()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shown = filter === "all" ? logs : logs.filter((l) => l.kind === filter);

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="学习日志"
        description="费曼讲稿 · 周复盘 · 项目笔记 · 面试记录，输出倒逼输入"
        eyebrow={
          domain ? (
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 rounded-xl border border-border-button-default bg-background-secondary-default py-1.5 pe-2.5 ps-2 transition-colors hover:bg-background-secondary-hover"
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${domain.color}26`, color: domain.color }}
              >
                <DomainIcon icon={domain.icon} className="size-3.5" />
              </span>
              <span className="max-w-40 truncate text-body-2-medium text-text-secondary">{domain.name}</span>
              <ArrowRight className="size-3.5 shrink-0 text-foreground-icon-tertiary" />
            </Link>
          ) : undefined
        }
        actions={
          <Button variant="secondary" onClick={exportJson}>
            <Download className="size-4" /> 导出 JSON
          </Button>
        }
      />

      {/* 筛选收进紧凑工具条（不再单独占一整行） */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            {KINDS.map((k) => (
              <TabsTrigger key={k} value={k}>
                {logKindLabels[k]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="ms-auto text-body-2-medium tabular-nums text-text-tertiary">
          {shown.length} 篇
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 写日志：左列 340 高，正文自行伸缩，按钮留在卡内可见 */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default">
          <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
              <PenLine className="size-4 text-foreground-icon-secondary" />
            </span>
            <h2 className="min-w-0 truncate text-headline-medium text-text-primary">写一篇日志</h2>
            <span className="ms-auto shrink-0 rounded-full bg-background-tertiary-default px-2 py-0.5 text-caption-1-medium text-text-secondary">
              {logKindLabels[kind]}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5">
            <Tabs value={kind} onValueChange={(v) => setKind(v as (typeof KINDS)[number])}>
              <TabsList>
                {KINDS.map((k) => (
                  <TabsTrigger key={k} value={k}>
                    {logKindLabels[k]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Input ref={titleRef} placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              placeholder="写下你的理解 / 复盘 / 项目进展…（用教别人的方式检验是否真懂）"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[220px] flex-1 resize-none text-body-medium leading-relaxed"
            />
            <Button onClick={addLog} className="self-end">
              <Plus className="size-4" /> 保存日志
            </Button>
          </div>
        </section>

        {/* 日志列表：卡内滚动 + 顶部渐隐，页面不再被 200 条日志拉长 */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default lg:h-[340px]">
          <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-primary-default">
              <NotebookPen className="size-4 text-foreground-icon-secondary" />
            </span>
            <h2 className="min-w-0 truncate text-headline-medium text-text-primary">日志列表</h2>
            <span className="ms-auto shrink-0 rounded-full bg-background-primary-default px-2 py-0.5 text-caption-1-medium text-text-secondary">
              {filter === "all" ? "全部" : logKindLabels[filter] ?? filter}
            </span>
          </div>
          <div className="min-h-0 flex-1 px-5 pb-4">
            <ScrollFade className="h-full">
              <LogsList
                entries={shown}
                resetKey={filter}
                empty={
                  <EmptyState
                    icon={NotebookPen}
                    title="还没有日志"
                    hint="写下第一篇费曼讲稿或复盘，用输出倒逼输入"
                    action={
                      <Button
                        size="sm"
                        onClick={() => {
                          titleRef.current?.focus();
                          titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                      >
                        <Plus className="size-4" /> 写第一篇日志
                      </Button>
                    }
                  />
                }
              />
            </ScrollFade>
          </div>
        </section>
      </div>
    </div>
  );
}
