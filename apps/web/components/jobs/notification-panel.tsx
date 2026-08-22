"use client";

import { useEffect, useRef, useState } from "react";
import type { JobNotification } from "@learn-workbench/shared";
import { formatRelativeTime } from "@learn-workbench/shared";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react";

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<JobNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch("/api/jobs/notifications?limit=20");
      if (!r.ok) return;
      const d = (await r.json()) as { notifications: JobNotification[]; unread: number };
      setNotifications(d.notifications ?? []);
      setUnread(d.unread ?? 0);
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
// eslint-disable-next-line react-hooks/set-state-in-effect -- 轮询加载通知并写状态（既有模式）
    void load(true);
    const timer = window.setInterval(() => void load(true), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markRead = async (id?: number) => {
    try {
      await fetch("/api/jobs/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id ?? "all" }),
      });
      if (id) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        setUnread((u) => Math.max(0, u - 1));
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnread(0);
      }
    } catch {
      // 静默失败
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="通知"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load(false);
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-muted-foreground backdrop-blur-md transition-all hover:bg-white/15 hover:text-foreground"
      >
        <Bell className="size-4.5" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="job-modal-panel glass absolute right-0 top-12 z-[70] w-[min(92vw,360px)] overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-bold text-foreground">订阅提醒</span>
            <button
              type="button"
              onClick={() => void markRead()}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-emerald-600 disabled:opacity-40 dark:hover:text-emerald-300"
            >
              <CheckCheck className="size-3.5" />
              全部已读
            </button>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-2 text-xs text-muted-foreground">暂无订阅提醒，去设置页创建订阅吧</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.read) void markRead(n.id);
                    if (n.url) window.open(n.url, "_blank", "noopener,noreferrer");
                  }}
                  className={cn(
                    "cursor-pointer border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/10",
                    !n.read && "bg-emerald-500/[0.06]"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.read ? "bg-white/20" : "bg-emerald-400")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-snug text-foreground">{n.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        {formatRelativeTime(n.createdAt)}
                        <ExternalLink className="size-2.5" />
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
