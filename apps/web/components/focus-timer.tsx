"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QUOTES } from "@/components/quote-widget";
import { FocusStatsCard } from "@/components/focus-stats-card";
import {
  Pause, Play, RotateCcw, Square, X, Maximize, Minimize, Quote,
  Palette, ImagePlus, Images, Pencil, Check, Coffee, Droplets, Footprints,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_COLORS, FOCUS_GALLERY, useFocusBgStore } from "@/store/focus-bg-store";
import { useToastStore } from "@/store/toast-store";

const PRESETS = [15, 25, 45];
const RING_R = 128;
const RING_C = 2 * Math.PI * RING_R;

function fmtClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function BackgroundLayer() {
  const { mode, color, uploadUrl, galleryId } = useFocusBgStore();
  const [bing, setBing] = useState<string | null>(null);

  useEffect(() => {
    if (!(mode === "gallery" && galleryId === "bing")) return;
    let alive = true;
    fetch("/api/background")
      .then((r) => (r.ok ? (r.json() as Promise<{ exists?: boolean; date?: string }>) : null))
      .then((d) => {
        if (alive && d?.exists && d.date) setBing(`/api/background/img?date=${encodeURIComponent(d.date)}`);
        else setBing(null);
      })
      .catch(() => setBing(null));
    return () => {
      alive = false;
    };
  }, [mode, galleryId]);

  if (mode === "color") {
    return <div className="absolute inset-0" style={{ backgroundColor: color }} />;
  }
  if (mode === "upload" && uploadUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={uploadUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  }
  if (mode === "gallery" && galleryId === "bing") {
    if (bing) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={bing} alt="" className="absolute inset-0 h-full w-full object-cover" />;
    }
    return <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />;
  }
  const g = FOCUS_GALLERY.find((x) => x.id === galleryId) ?? FOCUS_GALLERY[0];
  return <div className="absolute inset-0" style={{ background: g.css }} />;
}

export function FocusTimer({
  open,
  task,
  onClose,
  onRecorded,
  autoStart = false,
  mode = "focus",
  initialMinutes,
}: {
  open: boolean;
  task: { id: number | null; title: string | null } | null;
  onClose: () => void;
  onRecorded?: () => void;
  autoStart?: boolean;
  mode?: "focus" | "exercise";
  initialMinutes?: number;
}) {
  const bg = useFocusBgStore();
  const initMinutes = initialMinutes ?? (bg.minutes || 25);
  const [minutes, setMinutesState] = useState(initMinutes);
  const [total, setTotal] = useState(initMinutes * 60);
  const [remaining, setRemaining] = useState(initMinutes * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [full, setFull] = useState(false);
  const [showBg, setShowBg] = useState(false);
  const [quote, setQuote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteInput, setQuoteInput] = useState("");
  const [wbDone, setWbDone] = useState<{ break?: boolean; water?: boolean }>({});
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(initMinutes * 60);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoStartedRef = useRef(false);
  const exerciseRecordedRef = useRef(false);

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

  // 打开：等待用户点击「开始专注」后再启动计时并请求全屏
  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [open]);

  const start = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (startRef.current === null) startRef.current = Date.now() - (total - remaining) * 1000;
    setRunning(true);
    timerRef.current = setInterval(tick, 1000);
  };

  const begin = () => {
    setStarted(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().then(() => setFull(true)).catch(() => {});
    }
    start();
  };

  // 快捷开始：autoStart 时挂载后自动进入倒计时（仍允许暂停/结束）
  useEffect(() => {
    if (!open || !autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoStart]);

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
    setMinutesState(m);
    bg.setMinutes(m);
    setTotal(m * 60);
    setRemainingSafe(m * 60);
    setRunning(false);
    startRef.current = null;
    setDone(false);
  };

  const record = async (elapsedSeconds: number) => {
    if (recording) return;
    // 运动模式：只写 exercise_logs，不计专注 session / 专注时长
    if (mode === "exercise") {
      if (elapsedSeconds < 60) {
        useToastStore.getState().push("不足 1 分钟，未计入", "info");
        onClose();
        return;
      }
      setRecording(true);
      const startedAt = new Date(Date.now() - elapsedSeconds * 1000).toISOString();
      try {
        await fetch("/api/wellbeing/exercise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "OTHER",
            typeLabel: "一键运动",
            durationSeconds: elapsedSeconds,
            source: "FOCUS",
            startedAt,
          }),
        });
        useToastStore.getState().push(`运动完成 +${Math.round(elapsedSeconds / 60)} 分钟`);
      } catch {
        // 忽略
      }
      setRecording(false);
      onClose();
      return;
    }
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
      // 忽略
    }
    setRecording(false);
    onRecorded?.();
    onClose();
  };

  // 运动模式：倒计时自然结束自动按实际时长写入运动记录
  useEffect(() => {
    if (!done || mode !== "exercise" || exerciseRecordedRef.current) return;
    exerciseRecordedRef.current = true;
    record(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, mode, total]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().then(() => setFull(true)).catch(() => {});
    }
  };

  const onUpload = (file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      alert("图片较大，请选择 3MB 以内的图片");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      bg.setUploadUrl(String(reader.result));
      bg.setMode("upload");
    };
    reader.readAsDataURL(file);
  };

  const recordBreakDone = async () => {
    await fetch("/api/wellbeing/breaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "MOVEMENT", minutes: 5 }),
    });
    setWbDone((s) => ({ ...s, break: true }));
  };

  const recordWaterDone = async () => {
    await fetch("/api/wellbeing/hydration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMl: 250, source: "FOCUS_BREAK" }),
    });
    setWbDone((s) => ({ ...s, water: true }));
  };

  const saveQuote = () => {
    const v = quoteInput.trim();
    if (v) {
      bg.setCustomQuote(v);
      setQuote({ text: v });
    } else {
      bg.setCustomQuote(null);
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    }
    setEditingQuote(false);
  };

  const ratio = total > 0 ? remaining / total : 0;
  const elapsed = total - remaining;
  const sessionLabel = mode === "exercise" ? "运动中" : (task?.title ?? "自由专注");
  const shownQuote = bg.customQuote ? { text: bg.customQuote, author: undefined as string | undefined } : quote;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-black/80">
      <BackgroundLayer />
      {/* 可读性遮罩 */}
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      

      {/* 顶部：仅保留退出全屏提示 */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md transition-all hover:bg-white/20"
          >
            {full ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
            {full ? "退出全屏 (Esc)" : "进入全屏"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBg((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md transition-all hover:bg-white/20"
          >
            <Palette className="size-3.5" /> 背景
          </button>
          <button
            onClick={() => (running || elapsed > 0 ? record(elapsed) : onClose())}
            aria-label="关闭"
            className="rounded-full border border-white/20 bg-white/10 p-2 text-white/80 backdrop-blur-md transition-all hover:bg-white/20"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* 背景设置面板 */}
      {showBg ? (
        <div className="glass relative z-10 mx-auto mt-3 w-[min(92vw,420px)] rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2">
            {[
              { key: "gallery", label: "默认图库", icon: Images },
              { key: "color", label: "纯色", icon: Palette },
              { key: "upload", label: "自定义图片", icon: ImagePlus },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => bg.setMode(m.key as "gallery" | "color" | "upload")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs transition-all",
                  bg.mode === m.key
                    ? "border-primary/60 bg-primary/25 text-foreground"
                    : "border-white/20 bg-white/10 text-muted-foreground hover:bg-white/15"
                )}
              >
                <m.icon className="size-3.5" /> {m.label}
              </button>
            ))}
          </div>
          {bg.mode === "color" ? (
            <div className="flex flex-wrap gap-2">
              {FOCUS_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => bg.setColor(c)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-all",
                    bg.color === c ? "scale-110 border-white" : "border-white/30"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`背景色 ${c}`}
                />
              ))}
              <label className="flex h-9 cursor-pointer items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 text-xs text-white/80">
                自定义
                <input
                  type="color"
                  value={bg.color}
                  onChange={(e) => bg.setColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
            </div>
          ) : null}
          {bg.mode === "upload" ? (
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white/90 transition-all hover:bg-white/20"
              >
                <ImagePlus className="size-4" /> 选择本地图片（≤3MB）
              </button>
              {bg.uploadUrl ? (
                <p className="text-center text-xs text-white/60">已上传自定义背景，点击上方可更换</p>
              ) : null}
            </div>
          ) : null}
          {bg.mode === "gallery" ? (
            <div className="grid grid-cols-4 gap-2">
              {FOCUS_GALLERY.map((g) => (
                <button
                  key={g.id}
                  onClick={() => bg.setGalleryId(g.id)}
                  className={cn(
                    "flex h-14 items-center justify-center overflow-hidden rounded-xl border text-[10px] text-white transition-all",
                    bg.galleryId === g.id ? "border-white ring-2 ring-primary/50" : "border-white/20"
                  )}
                  style={g.css ? { background: g.css } : { background: "linear-gradient(135deg,#1e293b,#0f172a)" }}
                >
                  {g.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 主区域 */}
      {done ? (
        <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-6 pt-4">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
            <p className="text-2xl font-bold text-white drop-shadow">🎉 专注完成！</p>
            <p className="text-sm text-white/70">本次专注 {fmtClock(elapsed)}，已自动记录</p>

            {/* 休息一下：站立 + 喝水 + 远眺 */}
            <div className="glass w-full max-w-md rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Coffee className="size-4 text-success" /> 休息一下再继续
              </div>
              <p className="mt-1 text-xs text-white/70">站立 + 喝水 + 远眺 5 分钟，让注意力回血</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={recordBreakDone}
                  disabled={wbDone.break}
                  className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur-md transition-all hover:bg-white/25 disabled:opacity-60"
                >
                  <Footprints className="size-3.5" /> {wbDone.break ? "已记录休息" : "记录休息"}
                </button>
                <button
                  onClick={recordWaterDone}
                  disabled={wbDone.water}
                  className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur-md transition-all hover:bg-white/25 disabled:opacity-60"
                >
                  <Droplets className="size-3.5" /> {wbDone.water ? "已喝水 +250ml" : "喝水 +250ml"}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md transition-all hover:bg-white/25"
                >
                  去记录精力
                </button>
              </div>
            </div>

            <FocusStatsCard />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  reset();
                  start();
                }}
                className="rounded-full border border-white/25 bg-white/15 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/25"
              >
                再来一次
              </button>
              <button
                onClick={onClose}
                className="rounded-full bg-gradient-to-b from-primary to-[#4338ca] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-105"
              >
                返回任务页
              </button>
            </div>
          </div>
        </div>
      ) : started ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4">
          {/* 任务名 + 状态 */}
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="max-w-xl truncate rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-md">
              {sessionLabel}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-white/70">
              <span className={cn("size-1.5 rounded-full", running ? "bg-success animate-pulse" : "bg-white/40")} />
              {running ? (mode === "exercise" ? "运动中 · 保持节奏" : "专注中 · 保持节奏") : "已暂停"}
            </span>
          </div>

          {/* 环形进度 + 数字时钟（视觉正中） */}
          <div className={cn("relative flex items-center justify-center", started && "timer-pop")}>
            <svg width="min(72vw,340px)" height="min(72vw,340px)" viewBox="0 0 300 300" className="drop-shadow-[0_6px_30px_rgba(0,0,0,0.4)]">
              <defs>
                <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  {mode === "exercise" ? (
                    <>
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0ea5e9" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#ffb25e" />
                      <stop offset="100%" stopColor="#ff6a5e" />
                    </>
                  )}
                </linearGradient>
              </defs>
              <circle cx="150" cy="150" r={RING_R} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="12" />
              <circle
                cx="150"
                cy="150"
                r={RING_R}
                fill="none"
                stroke="url(#ring-grad)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - ratio)}
                transform="rotate(-90 150 150)"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <button
              onClick={() => (running ? pause() : start())}
              className="absolute inset-0 m-auto flex h-[min(40vw,190px)] w-[min(40vw,190px)] items-center justify-center rounded-full text-white"
              aria-label={running ? "暂停" : "继续"}
            >
              <span className="font-mono text-[min(13vw,64px)] font-bold leading-none tabular-nums drop-shadow-[0_3px_18px_rgba(0,0,0,0.5)]">
                {fmtClock(remaining)}
              </span>
            </button>
          </div>

          {/* 控制按钮：暂停/重置/结束 */}
          <div className="mt-1 flex items-center gap-4">
            <button
              onClick={() => (running ? pause() : start())}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25"
              aria-label={running ? "暂停" : "继续"}
            >
              {running ? <Pause className="size-6" /> : <Play className="size-6 translate-x-0.5" />}
            </button>
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
              aria-label="结束计时"
            >
              <Square className="size-5" />
            </button>
          </div>

          {/* 时长快速选择 */}
          <div className="flex flex-wrap items-center justify-center gap-2">
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
            <label className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur-md">
              <input
                type="number"
                min={1}
                max={180}
                value={minutes}
                onChange={(e) => {
                  const v = Math.min(180, Math.max(1, Number(e.target.value) || 1));
                  changePreset(v);
                }}
                className="w-10 bg-transparent text-center text-white outline-none"
              />
              <span className="text-xs text-white/60">分</span>
            </label>
          </div>

          {/* 每日一言（可自定义） */}
          <div className="glass flex max-w-lg flex-col gap-1.5 rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Quote className="size-3.5" /> 励志短句
              </span>
              <button
                onClick={() => {
                  setEditingQuote((v) => !v);
                  setQuoteInput(bg.customQuote ?? "");
                }}
                className="rounded-lg p-1 text-white/60 transition-all hover:bg-white/15 hover:text-white"
                aria-label="编辑励志短句"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
            {editingQuote ? (
              <div className="flex items-center gap-2">
                <input
                  value={quoteInput}
                  onChange={(e) => setQuoteInput(e.target.value)}
                  placeholder="输入你的励志短句…"
                  className="h-9 flex-1 rounded-lg border border-white/25 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/40"
                />
                <button
                  onClick={saveQuote}
                  className="rounded-lg border border-white/25 bg-white/15 p-2 text-white transition-all hover:bg-white/25"
                  aria-label="保存"
                >
                  <Check className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-white/90">{shownQuote.text}</p>
                {shownQuote.author ? (
                  <span className="self-end text-xs text-white/60">—— {shownQuote.author}</span>
                ) : null}
              </>
            )}
          </div>

          {/* 移动端横屏提示 */}
          <p className="text-xs text-white/40 lg:hidden">横屏使用，数字时钟更沉浸</p>
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="max-w-xl truncate rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-md">
              {sessionLabel}
            </span>
            <span className="text-xs text-white/70">准备开始 · {minutes} 分钟</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
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
            <label className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur-md">
              <input
                type="number"
                min={1}
                max={180}
                value={minutes}
                onChange={(e) => {
                  const v = Math.min(180, Math.max(1, Number(e.target.value) || 1));
                  changePreset(v);
                }}
                className="w-10 bg-transparent text-center text-white outline-none"
              />
              <span className="text-xs text-white/60">分</span>
            </label>
          </div>

          <button
            onClick={begin}
            className="flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-[#4338ca] px-10 py-4 text-base font-semibold text-white shadow-[0_10px_40px_rgba(79,70,229,0.45)] transition-all hover:brightness-105"
          >
            <Play className="size-5" /> {mode === "exercise" ? "开始运动" : "开始专注"}
          </button>
          <p className="text-xs text-white/50">开始后将进入全屏，可随时暂停或结束</p>
        </div>
      )}
    </div>
  );
}
