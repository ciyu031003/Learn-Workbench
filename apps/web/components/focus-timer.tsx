"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QUOTES } from "@/components/quote-widget";
import { FocusStatsCard } from "@/components/focus-stats-card";
import {
  Pause, Play, RotateCcw, Square, X, Maximize, Minimize, Quote,
  Palette, ImagePlus, Images, Pencil, Check, Coffee, Droplets, Footprints, TreePine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_COLORS, FOCUS_GALLERY, useFocusBgStore } from "@/store/focus-bg-store";
import { useToastStore } from "@/store/toast-store";
import { MIN_FOCUS_SECONDS, MIN_EXERCISE_SECONDS } from "@/lib/focus-session";
import { Celebration } from "@/components/celebration";

const PRESETS = [15, 25, 45];
const RING_R = 128;
const RING_C = 2 * Math.PI * RING_R;
/** 计时间隔上报：每 15 秒将已学习时长持久化到服务端（开始即建 session，杜绝关页丢时长） */
const FLUSH_INTERVAL_MS = 15_000;
/** 目标总时长上限（秒）：防御客户端异常，服务端也复核 */
const MAX_SESSION_SECONDS = 12 * 3600;
function fmtClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function clampSec(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
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
  exerciseLabel,
  exerciseType,
}: {
  open: boolean;
  task: { id: number | null; title: string | null } | null;
  onClose: () => void;
  onRecorded?: () => void;
  autoStart?: boolean;
  mode?: "focus" | "exercise";
  initialMinutes?: number;
  /** 运动项目名（exercise 模式记录 type_label） */
  exerciseLabel?: string | null;
  /** 运动大类（exercise 模式记录 type） */
  exerciseType?: string | null;
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
  const [celebration, setCelebration] = useState<"sparkle" | "confetti" | null>(null);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(initMinutes * 60);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoStartedRef = useRef(false);
  const exerciseRecordedRef = useRef(false);
  const exerciseLabelRef = useRef<string | null>(exerciseLabel ?? null);
  const exerciseTypeRef = useRef<string | null>(exerciseType ?? null);
  useEffect(() => {
    exerciseLabelRef.current = exerciseLabel ?? null;
    exerciseTypeRef.current = exerciseType ?? null;
  }, [exerciseLabel, exerciseType]);
  const sessionRef = useRef<{ id: string; startedAt: string; settled: boolean; recorded: boolean } | null>(null);
  const lastFlushRef = useRef<number>(0);
  const lastVisibleRef = useRef<number>(0);
  const idleStartedAtRef = useRef<number | null>(null);
  const visibleElapsedRef = useRef(0);

  const taskIdRef = useRef(task?.id ?? null);
  const modeRef = useRef(mode);
  const onRecordedRef = useRef(onRecorded);
  const onCloseRef = useRef(onClose);
  // 最新值同步到 ref（render 之外执行，供事件/effect 使用）
  useEffect(() => {
    taskIdRef.current = task?.id ?? null;
    modeRef.current = mode;
    onRecordedRef.current = onRecorded;
    onCloseRef.current = onClose;
  }, [task, mode, onRecorded, onClose]);

  const setRemainingSafe = useCallback((n: number) => {
    remainingRef.current = n;
    setRemaining(n);
  }, []);

  const clearTimerRef = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  // 每秒走秒 + 倒计时归零
  const tick = useCallback(() => {
    const next = Math.max(0, remainingRef.current - 1);
    if (!document.hidden) visibleElapsedRef.current += 1;
    remainingRef.current = next;
    setRemaining(next);
    if (next === 0) {
      setRunning(false);
      setDone(true);
      clearTimerRef();
    }
  }, [clearTimerRef]);

  // 会话开始时只登记本地 session（生成稳定 client_id），
  // 服务端记录在首次「有实际学习秒数」的续写/结算时创建（client_id 幂等 upsert），
  // 避免「开始即退」产生 0 秒噪音记录；学了 2 分钟退出也会在结算时完整入库。
  const ensureSession = useCallback(() => {
    if (sessionRef.current) return;
    const clientId = `focus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionRef.current = {
      id: clientId,
      startedAt: new Date().toISOString(),
      settled: false,
      recorded: false,
    };
  }, []);

  // 计算本会话实际学习时长（专注：秒数计数=开着手表时间；运动：同一规则，落库的是跑到当前真实耗时）
  const currentElapsed = useCallback(() => {
    if (startRef.current === null) return 0;
    return Math.max(0, visibleElapsedRef.current);
  }, []);

  // 结算会话：把已学时长一次性写入服务端并标记（不关闭弹层；供自然结束自动入账）
  const settleSession = useCallback(async (elapsedSeconds: number) => {
    const ses = sessionRef.current;
    const el = clampSec(elapsedSeconds);
    if (!ses || ses.settled) return;
    if (el < MIN_FOCUS_SECONDS) return;
    const finalSec = Math.min(el, MAX_SESSION_SECONDS);
    const parsedStart = Date.parse(ses.startedAt);
    try {
      await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: ses.id,
          started_at: ses.startedAt,
          ended_at: new Date(parsedStart + finalSec * 1000).toISOString(),
          task_id: taskIdRef.current,
          duration_seconds: finalSec,
          settle: true,
        }),
      });
    } catch {
      // 忽略
    }
    ses.settled = true;
    ses.recorded = true;
    onRecordedRef.current?.();
  }, []);

  // 统一结算：按当前墙钟累计（非倒计时差），专注实际 ≥5s 即入库；运动仍需 ≥1 分钟。
  const record = useCallback(async (elapsedSeconds: number) => {
    if (recording) return;
    const s = sessionRef.current;
    const now = new Date();
    const elapsed = clampSec(elapsedSeconds);
    if (modeRef.current === "exercise") {
      if (elapsed < MIN_EXERCISE_SECONDS) {
        exerciseRecordedRef.current = true;
        useToastStore.getState().push("不足 1 分钟，未计入", "info");
        onCloseRef.current();
        return;
      }
      setRecording(true);
      try {
        await fetch("/api/wellbeing/exercise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: ["BALL", "AEROBIC", "STRENGTH", "STRETCH", "MOVE"].includes(exerciseTypeRef.current ?? "") ? exerciseTypeRef.current! : "OTHER",
            typeLabel: exerciseLabelRef.current ?? "一键运动",
            durationSeconds: elapsed,
            source: "FOCUS",
            startedAt: new Date(now.getTime() - elapsed * 1000).toISOString(),
          }),
        });
        useToastStore.getState().push(`运动完成 +${Math.round(elapsed / 60)} 分钟`);
      } catch {
        // 忽略
      }
      if (s) {
        s.settled = true;
        s.recorded = true;
      }
      setRecording(false);
      onCloseRef.current();
      return;
    }

    if (!s) {
      if (elapsed < MIN_FOCUS_SECONDS) {
        onCloseRef.current();
        return;
      }
      // 没建上 session 也要尽力把学习时长落库（按已学习时间补一条）
      const startedAt = new Date(now.getTime() - elapsed * 1000).toISOString();
      await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt, endedAt: now.toISOString(), taskId: taskIdRef.current }),
      });
      onRecordedRef.current?.();
      onCloseRef.current();
      return;
    }

    if (elapsed >= MIN_FOCUS_SECONDS && !s.settled) {
      setRecording(true);
      await settleSession(elapsed);
      setRecording(false);
    }
    onCloseRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, exerciseRecordedRef]);

  // 间隔续写：把已学习总时长写进服务端（同一 client_id 幂等 upsert，时长单调取大）
  const flushElapsed = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || s.settled || modeRef.current === "exercise") return;
    const elapsed = Math.min(currentElapsed(), MAX_SESSION_SECONDS);
    if (elapsed < MIN_FOCUS_SECONDS) return;
    const nowMs = Date.now();
    if (nowMs - lastFlushRef.current < 4000) return; // 简单防重入
    lastFlushRef.current = nowMs;
    setRecording(true);
    try {
      const parsedStart = Date.parse(s.startedAt);
      await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: s.id,
          started_at: s.startedAt,
          ended_at: new Date(parsedStart + elapsed * 1000).toISOString(),
          task_id: taskIdRef.current,
          duration_seconds: elapsed,
        }),
      });
    } catch {
      // 忽略
    }
    setRecording(false);
  }, [currentElapsed]);

  // 离开结算（关页/刷新/跳导航/切后台）：把已学可见秒数一次写死（幂等）。
  const settleOnExit = useCallback(async () => {
    if (modeRef.current !== "focus") return;
    const s = sessionRef.current;
    if (!s) return;
    const elapsed = Math.min(currentElapsed(), MAX_SESSION_SECONDS);
    if (elapsed >= MIN_FOCUS_SECONDS && !s.settled) {
      const endedAt = new Date(Date.parse(s.startedAt) + elapsed * 1000).toISOString();
      await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: s.id,
          started_at: s.startedAt,
          ended_at: endedAt,
          task_id: taskIdRef.current,
          duration_seconds: elapsed,
          settle: true,
        }),
      }).catch(() => {});
      s.settled = true;
      s.recorded = true;
      if (modeRef.current === "focus") onRecordedRef.current?.();
    }
    lastVisibleRef.current = Date.now();
    idleStartedAtRef.current = null;
  }, [currentElapsed]);

  // 打开：等待用户点击「开始专注」后再启动计时并请求全屏；首次开始即建服务端 session
  useEffect(() => {
    if (!open) return;
    clearTimerRef();
    lastFlushRef.current = 0;
    lastVisibleRef.current = Date.now();

    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);

    const onVisibility = () => {
      if (document.hidden) {
        void flushElapsed();
      } else {
        lastVisibleRef.current = Date.now();
        idleStartedAtRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPageHide = () => void settleOnExit();

    // 定时把已学习秒数写进服务端（专注模式；运动模式只在结束时整笔写入）
    const flushId = window.setInterval(() => {
      void flushElapsed();
    }, FLUSH_INTERVAL_MS);

    return () => {
      clearTimerRef();
      clearInterval(flushId);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [open, clearTimerRef, flushElapsed, settleOnExit]);

  // 打开时若有尚未结算的 session，用户在页面任意关闭流程（X/结束/返回/离开）都会统一结算；
  // 卸载前最后一次 flush（确保拿到最终 elapsed 才销毁）。
  useEffect(() => {
    if (!open) return;
    // 卸载前兜底：页面离开 = 会话结束，结算已学时长
    return () => {
      if (sessionRef.current && !sessionRef.current.settled) {
        void settleOnExit();
      }
    };
  }, [open, settleOnExit]);

  const start = () => {
    clearTimerRef();
    if (startRef.current === null) {
      startRef.current = Date.now();
      if (!sessionRef.current) visibleElapsedRef.current = 0;
    }
    setRunning(true);
    if (!sessionRef.current) void ensureSession();
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
    clearTimerRef();
    setRunning(false);
  };

  const reset = () => {
    clearTimerRef();
    setRunning(false);
    setRemainingSafe(total);
    startRef.current = null;
    exerciseRecordedRef.current = false;
    setCelebration(null);
    // 重置前把已学时长结算入库（含中间切换预设/再来一次的场景）
    if (sessionRef.current && !sessionRef.current.settled) {
      const el = currentElapsed();
      if (el >= MIN_FOCUS_SECONDS) {
        void settleOnExit();
      }
      sessionRef.current = null;
      lastVisibleRef.current = Date.now();
      idleStartedAtRef.current = null;
    }
    visibleElapsedRef.current = 0;
    setDone(false);
  };

  const changePreset = (m: number) => {
    clearTimerRef();
    setMinutesState(m);
    bg.setMinutes(m);
    setTotal(m * 60);
    setRemainingSafe(m * 60);
    setRunning(false);
    startRef.current = null;
    exerciseRecordedRef.current = false;
    if (sessionRef.current && !sessionRef.current.settled) {
      void flushElapsed();
    }
    setDone(false);
  };

  // 专注模式：倒计时自然结束自动入账（不关闭，done 页继续展示统计）
  useEffect(() => {
    if (!done || mode !== "focus" || exerciseRecordedRef.current) return;
    exerciseRecordedRef.current = true;
    void settleSession(currentElapsed());
    setCelebration("confetti");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, mode]);

  // 运动模式：倒计时自然结束自动按实际时长写入运动记录
  useEffect(() => {
    if (!done || mode !== "exercise" || exerciseRecordedRef.current) return;
    exerciseRecordedRef.current = true;
    void record(currentElapsed());
    setCelebration("confetti");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, mode]);

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
      {celebration ? (
        <Celebration
          kind={celebration}
          message={mode === "exercise" ? "运动目标完成！" : "专注完成！"}
          onDone={() => setCelebration(null)}
        />
      ) : null}
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
            onClick={() => {
              const el = currentElapsed();
              if (el >= MIN_FOCUS_SECONDS || running || (elapsed > 0 && mode === "focus")) void record(el);
              else onCloseRef.current();
            }}
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
            <p className="text-2xl font-bold text-white drop-shadow">🎉 {mode === "exercise" ? "运动完成" : "专注完成"}！</p>
            <p className="text-sm text-white/70">本次{mode === "exercise" ? "运动" : "专注"} {fmtClock(elapsed)}，已自动记录</p>
            <div className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/20 px-4 py-2 text-sm text-white backdrop-blur-md">
              <TreePine className="size-4 text-success" />
              <span className="font-semibold">专注果实 +{Math.max(1, Math.min(180, Math.round(elapsed / 60)))}</span>
            </div>

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
                  onClick={() => {
                    if (sessionRef.current && !sessionRef.current.settled) void settleOnExit();
                    onCloseRef.current();
                  }}
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
                onClick={() => {
                  if (sessionRef.current && !sessionRef.current.settled) void settleOnExit();
                  onCloseRef.current();
                }}
                className="rounded-full bg-gradient-to-b from-primary to-primary-strong px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-105"
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
                      <stop offset="0%" stopColor="#8bb7e8" />
                      <stop offset="100%" stopColor="#2f74c0" />
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
              onClick={() => record(currentElapsed())}
              disabled={elapsed < 10 && mode === "focus" && remaining === total}
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
            className="flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-strong px-10 py-4 text-base font-semibold text-white shadow-[0_10px_40px_rgba(23,37,84,0.4)] transition-all hover:brightness-105"
          >
            <Play className="size-5" /> {mode === "exercise" ? "开始运动" : "开始专注"}
          </button>
          <p className="text-xs text-white/50">开始后将进入全屏，可随时暂停或结束</p>
        </div>
      )}
    </div>
  );
}
