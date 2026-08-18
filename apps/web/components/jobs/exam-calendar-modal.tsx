"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ExamEvent } from "@learn-workbench/shared";
import { jobSourceLabel } from "@learn-workbench/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarDays, ExternalLink, Loader2, X } from "lucide-react";

const KIND_STYLE: Record<string, { color: string; label: string }> = {
  apply_start: { color: "#10b981", label: "报名开始" },
  apply_end: { color: "#f43f5e", label: "报名截止" },
  exam: { color: "#3b82f6", label: "笔试/考试" },
  interview: { color: "#8b5cf6", label: "面试" },
  result: { color: "#f59e0b", label: "成绩公布" },
};

export function ExamCalendarModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<ExamEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetch("/api/jobs/calendar?limit=40")
      .then(async (r) => {
        if (!r.ok) throw new Error("考试日历加载失败");
        return (await r.json()) as { events: ExamEvent[] };
      })
      .then((d) => {
        if (alive) setEvents(d.events ?? []);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "考试日历加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="job-modal-backdrop fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="job-modal-panel glass relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <CalendarDays className="size-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-foreground">考编考试日历</h2>
              <p className="text-xs text-muted-foreground">报名 / 笔试 / 面试时间节点 · 倒计时</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭日历"
            className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-white/15 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span className="ml-2 text-sm">正在加载考试日历…</span>
            </div>
          ) : error ? (
            <p className="rounded-xl border border-danger/30 bg-danger/15 px-3 py-3 text-sm text-foreground">{error}</p>
          ) : events.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarDays className="mx-auto size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">暂无已解析的考试时间节点</p>
              <p className="mt-1 text-xs text-muted-foreground/70">抓取公告后，报名/笔试/面试时间会自动出现在这里</p>
            </div>
          ) : (
            <div className="relative space-y-3 pl-5">
              <span className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-indigo-400/60 via-violet-400/40 to-transparent" />
              {events.map((ev) => {
                const st = KIND_STYLE[ev.kind] ?? { color: "#64748b", label: ev.label };
                const d = new Date(ev.eventAt);
                const md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                return (
                  <div key={ev.id} className="relative">
                    <span
                      className="absolute -left-5 top-3 size-3 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: st.color }}
                    />
                    <div className="glass rounded-2xl p-3 transition-all hover:-translate-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="muted" className="text-[10px]" style={{ color: st.color }}>
                          {st.label}
                        </Badge>
                        <span className="text-sm font-black tabular-nums text-foreground">{md}</span>
                        {ev.daysLeft <= 3 ? (
                          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-500 dark:text-rose-300">
                            {ev.daysLeft === 0 ? "就是今天" : `${ev.daysLeft} 天后`}
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            还剩 {ev.daysLeft} 天
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{ev.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{jobSourceLabel(ev.source)}</span>
                        {ev.note ? <span>· {ev.note}</span> : null}
                        {ev.url ? (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-300"
                          >
                            <ExternalLink className="size-3" />
                            原文
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-white/10 px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
