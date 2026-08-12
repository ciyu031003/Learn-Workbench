"use client";

import { useCallback, useEffect, useState } from "react";
import type { LogEntry } from "@learn-workbench/shared";
import { logKindLabels } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Plus, NotebookPen } from "lucide-react";

const KINDS = ["feynman", "review", "project", "interview"] as const;
const kindVariant: Record<string, "default" | "accent" | "success" | "muted"> = {
  feynman: "default",
  review: "accent",
  project: "success",
  interview: "muted",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("feynman");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/logs?limit=200");
    const data = await r.json();
    setLogs(data.logs ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addLog = async () => {
    if (!title.trim() || !content.trim()) return;
    const r = await fetch("/api/logs", {
      method: "POST",
      body: JSON.stringify({ kind, title: title.trim(), content: content.trim() }),
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
    a.download = `learn-workbench-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shown = filter === "all" ? logs : logs.filter((l) => l.kind === filter);

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-semibold tracking-tight lg:text-3xl">学习日志</h1>
          <p className="page-subtitle mt-1 text-sm">费曼讲稿 · 周复盘 · 项目笔记 · 面试记录，输出倒逼输入</p>
        </div>
        <Button variant="secondary" onClick={exportJson}>
          <Download className="size-4" /> 导出 JSON
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>写一篇日志</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Tabs value={kind} onValueChange={(v) => setKind(v as (typeof KINDS)[number])}>
            <TabsList>
              {KINDS.map((k) => (
                <TabsTrigger key={k} value={k}>
                  {logKindLabels[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="写下你的理解 / 复盘 / 项目进展…（用教别人的方式检验是否真懂）"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[340px] resize-y text-[15px] leading-relaxed"
          />
          <Button onClick={addLog} className="self-end">
            <Plus className="size-4" /> 保存日志
          </Button>
        </CardContent>
      </Card>

      <div>
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
      </div>

      <div className="flex flex-col gap-3">
        {shown.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <NotebookPen className="size-6" />
              还没有日志，写第一篇吧
            </CardContent>
          </Card>
        ) : (
          shown.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-5">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant={kindVariant[l.kind] ?? "default"}>{logKindLabels[l.kind] ?? l.kind}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString("zh-CN", { hour12: false })}
                  </span>
                </div>
                <h3 className="text-base font-semibold">{l.title}</h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{l.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}


