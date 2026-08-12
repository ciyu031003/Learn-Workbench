"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QUOTES } from "@/components/quote-widget";
import { Pause, Play, RotateCcw, Square, X, Maximize, Minimize, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const CLOCK_STYLES = [
  "font-sans text-[7rem] font-extrabold leading-none tracking-tight sm:text-[10rem]",
  "font-mono text-[7rem] font-semibold leading-none tracking-[0.12em] sm:text-[10rem]",
  "font-serif text-[7rem] font-black italic leading-none tracking-wide sm:text-[10rem]",
  "clock-outline text-[7rem] font-black leading-none tracking-tight sm:text-[10rem]",
];
const CLOCK_LABELS = ["极简", "数字", "优雅", "描边"];
const PRESETS = [15, 25, 45];

function fmtClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusTimer({
  open,
  task,
  onClose,
  onRecorded,
}: {
  open: boolean;
  task: { id: number | null; title: string | null } | null;
  onClose: () => void;
  onRecorded?: () => void;
}) {
  const [minutes, setMinutes] = useState(25);
  const [total, setTotal] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [style, setStyle] = useState(0);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [bg, setBg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [recording, setRecording] = useState(false);
  const [full, setFull] = useState(false);
  const startRef = useRef<number | null>(null);
  const remainingRef = useRef(25 * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/background")
      .then((r) => (r.ok ? (r.json() as Promise<{ exists?: boolean; date?: string }>) : null))
      .then((d) => {
        if (alive && d?.exists && d.date) {
          setBg(`/api/background/img?date=${encodeURIComponent(d.date)}`);
        } else {
          setBg(null);
        }
      })
      .catch(() => setBg(null));
    return () => {
      alive = false;
    };
  }, [open]);

  const setRemainingSafe = useCallback((n: number) => {
    remainingRef.current = n;
    setRemaining(n);
  }, []);

  const tick = useCallback(() => {
    const next = Math.max(0, remainingRef.current - 1);
    remainingRef.current = next;
    setRemaining(next);
    if (next === 0) {
      setRunning(false);
      setDone(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  const start = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (startRef.current === null) startRef.current = Date.now() - (total - remaining) * 1000;
    setRunning(true);
    timerRef.current = setInterval(tick, 1000);
  };

  const pause = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
  };

  const reset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    setRemainingSafe(total);
    startRef.current = null;
    setDone(false);
  };

  const changePreset = (m: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setMinutes(m);
    setTotal(m * 60);
    setRemainingSafe(m * 60);
    setRunning(false);
    startRef.current = null;
    setDone(false);
  };

  const record = async (elapsedSeconds: number) => {
    if (recording) return;
    if (elapsedSeconds < 10) {
      onClose();
      return;
    }
    setRecording(true);
    const now = new Date();
    const startedAt = new Date(now.getTime() - elapsedSeconds * 1000).toISOString();
    try {
      await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt, endedAt: now.toISOString(), taskId: task?.id ?? null }),
      });
    } catch {
      // 网络异常不阻塞关闭
    }
    setRecording(false);
    onRecorded?.();
    onClose();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setFull(false);
    } else {
      document.documentElement.requestFullscreen?.().then(() => setFull(true)).catch(() => {});
    }
  };

  const elapsed = total - remaining;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black/75">
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      {/* 暖调光晕 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(232,147,12,0.16),transparent_60%)]" />

      {/* 关闭 / 全屏 */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          onClick={toggleFullscreen}
          aria-label="全屏"
          className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white/90 backdrop-blur-md transition-all hover:bg-white/20"
        >
          {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
        </button>
        <button
          onClick={() => (running || elapsed > 0 ? record(elapsed) : onClose())}
          aria-label="关闭"
          className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white/90 backdrop-blur-md transition-all hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-5 px-4 text-center">
        {/* 任务标题 */}
        {task?.title ? (
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-md">
            {task.title}
          </div>
        ) : (
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-md">
            自由专注
          </div>
        )}

        {/* 数字时钟（点击切换样式） */}
        <button
          onClick={() => setStyle((s) => (s + 1) % CLOCK_STYLES.length)}
          aria-label="切换数字时钟样式"
          className="group relative text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-transform hover:scale-[1.02]"
        >
          <span className={cn("tabular-nums", CLOCK_STYLES[style])}>{fmtClock(remaining)}</span>
          <span className="mt-2 block text-[11px] tracking-widest text-white/55 opacity-0 transition-opacity group-hover:opacity-100">
            点击切换样式 · {CLOCK_LABELS[style]}
          </span>
        </button>

        {/* 预设时长 */}
        <div className="flex items-center gap-2">
          {PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => changePreset(m)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm backdrop-blur-md transition-all",
                minutes === m
                  ? "border-primary/60 bg-primary/30 text-white"
                  : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
              )}
            >
              {m} 分钟
            </button>
          ))}
        </div>

        {/* 控制按钮 */}
        <div className="mt-1 flex items-center gap-3">
          {running ? (
            <button
              onClick={pause}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25"
              aria-label="暂停"
            >
              <Pause className="size-6" />
            </button>
          ) : (
            <button
              onClick={start}
              disabled={remaining <= 0}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25 disabled:opacity-40"
              aria-label="开始"
            >
              <Play className="size-6 translate-x-0.5" />
            </button>
          )}
          <button
            onClick={reset}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25"
            aria-label="重置"
          >
            <RotateCcw className="size-5" />
          </button>
          <button
            onClick={() => record(elapsed)}
            disabled={elapsed < 10}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25 disabled:opacity-40"
            aria-label="结束并记录"
          >
            <Square className="size-5" />
          </button>
        </div>

        {done ? (
          <p className="rounded-full border border-success/40 bg-success/20 px-4 py-1.5 text-sm text-white backdrop-blur-md">
            🎉 专注完成！已自动记录本次会话
          </p>
        ) : (
          <p className="text-xs text-white/50">
            {running ? "专注中… 保持节奏" : elapsed >= 10 ? "已专注，可结束并记录" : "点击 ▶ 开始倒计时"}
          </p>
        )}

        {/* 每日一言 */}
        <div className="glass flex max-w-lg flex-col gap-1.5 rounded-2xl px-5 py-4">
          <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Quote className="size-3.5" /> 每日一言
          </span>
          <p className="text-sm leading-relaxed text-white/90">{quote.text}</p>
          {quote.author ? <span className="self-end text-xs text-white/60">—— {quote.author}</span> : null}
        </div>

        {/* 移动端横屏提示 */}
        <p className="text-xs text-white/40 lg:hidden">横屏使用，数字时钟更沉浸</p>
      </div>
    </div>
  );
}
