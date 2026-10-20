"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Celebration } from "@/components/celebration";
import { MIN_FOCUS_SECONDS, MIN_EXERCISE_SECONDS } from "@/lib/focus-session";
import { useFocusSession } from "@/lib/use-focus-session";
import { useFocusBgStore } from "@/store/focus-bg-store";
import { useToastStore } from "@/store/toast-store";
import { FocusBackgroundLayer } from "./focus/background-layer";
import { FocusBackgroundPanel } from "./focus/background-panel";
import { CompletionPanel } from "./focus/completion-panel";
import { RunningScreen } from "./focus/running-screen";
import { StartScreen } from "./focus/start-screen";
import { FocusTopBar } from "./focus/top-bar";
import { clampSec } from "./focus/format";

/**
 * 全屏专注/运动计时器（S8-a 拆分后的编排层）。
 *
 * 职责边界：
 *  - 计时状态机/持久化/跨刷新恢复：lib/use-focus-session（纯 TS，双端可复用）；
 *  - 服务端入账（flush / settle / 运动记录）：本文件内的副作用；
 *  - 展示：components/focus/*（背景层/背景面板/顶栏/计时显示/控制条/时长/每日一言/开始页/完成页）。
 *
 * DOM 结构、类名、文案与 S8-a 之前保持一致（纯搬迁）。
 */

/** 计时间隔上报：每 15 秒将已学习时长持久化到服务端（开始即建 session，杜绝关页丢时长） */
const FLUSH_INTERVAL_MS = 15_000;
/** 目标总时长上限（秒）：防御客户端异常，服务端也复核 */
const MAX_SESSION_SECONDS = 12 * 3600;

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
  const [recording, setRecording] = useState(false);
  /** V3 计时模式：countdown=倒计时（既有），stopwatch=正向秒表 */
  const [timerMode, setTimerMode] = useState<"countdown" | "stopwatch">("countdown");
  // S6-4：计时状态机 / 持久化 / 跨刷新恢复统一下沉到 useFocusSession
  const focus = useFocusSession({
    open,
    mode: timerMode,
    taskId: task?.id ?? null,
    initialMinutes: initMinutes,
  });
  const {
    running, started, finished, phase: focusPhase, minutes, total, remaining, ratio, elapsedSeconds,
    reset: resetFocusSession, persistNow, startBreak: startBreakSession,
  } = focus;
  const done = finished;
  /** 结束页：完成或休息中都复用同一块结果面板 */
  const doneView = finished || focusPhase === "break";
  /** v13 U3：计时视图（圆环 / 表盘），默认圆环，选择写进 localStorage */
  const [timerView, setTimerView] = useState<"ring" | "dial">("ring");
  useEffect(() => {
    let saved: "ring" | "dial" = "ring";
    try {
      const raw = window.localStorage.getItem("lwb.timer.view");
      if (raw === "dial" || raw === "ring") saved = raw;
    } catch {
      /* 隐私模式：读不到就用默认圆环 */
    }
    if (saved === "ring") return;
    // 延后一拍再设，避免"effect 内同步 setState 触发级联渲染"
    const t = setTimeout(() => setTimerView(saved), 0);
    return () => clearTimeout(t);
  }, []);
  // timerMode 是「受控值」：同时更新本地 state（UI 立即反馈）与状态机（归零 elapsed）
  const changeTimerMode = (next: "countdown" | "stopwatch") => {
    setTimerMode(next);
    focus.setMode(next);
  };
  const chooseTimerView = useCallback((v: "ring" | "dial") => {
    setTimerView(v);
    try {
      window.localStorage.setItem("lwb.timer.view", v);
    } catch {
      /* 隐私模式忽略 */
    }
  }, []);
  const [full, setFull] = useState(false);
  const [showBg, setShowBg] = useState(false);
  const [wbDone, setWbDone] = useState<{ break?: boolean; water?: boolean }>({});
  const [celebration, setCelebration] = useState<"sparkle" | "confetti" | null>(null);
  const autoStartedRef = useRef(false);
  const exerciseRecordedRef = useRef(false);
  const exerciseLabelRef = useRef<string | null>(exerciseLabel ?? null);
  const exerciseTypeRef = useRef<string | null>(exerciseType ?? null);
  useEffect(() => {
    exerciseLabelRef.current = exerciseLabel ?? null;
    exerciseTypeRef.current = exerciseType ?? null;
  }, [exerciseLabel, exerciseType]);
  const sessionRef = useRef<{ id: string; startedAt: string; settled: boolean; recorded: boolean } | null>(null);
  // 状态机生成/恢复的 client_id 同步到服务端入账层（刷新恢复后继续用同一个幂等键）
  useEffect(() => {
    if (!focus.sessionId || !focus.sessionStartedAt) return;
    if (sessionRef.current?.id === focus.sessionId) return;
    sessionRef.current = {
      id: focus.sessionId,
      startedAt: focus.sessionStartedAt,
      settled: false,
      recorded: false,
    };
  }, [focus.sessionId, focus.sessionStartedAt]);
  const lastFlushRef = useRef<number>(0);
  const lastVisibleRef = useRef<number>(0);
  const idleStartedAtRef = useRef<number | null>(null);

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

  // 墙钟 elapsed 由状态机统一计算（与旧 currentElapsed 语义一致：后台继续、暂停不计）
  const currentElapsed = elapsedSeconds;

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

    const onPageHide = () => {
      // 刷新/关页兜底：先把状态机快照写盘（跨刷新恢复），再结算服务端时长
      persistNow();
      void settleOnExit();
    };

    // 定时把已学习秒数写进服务端（专注模式；运动模式只在结束时整笔写入）
    const flushId = window.setInterval(() => {
      void flushElapsed();
    }, FLUSH_INTERVAL_MS);

    return () => {
      clearInterval(flushId);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [open, flushElapsed, settleOnExit, persistNow]);

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
    // 状态机：idle → running；paused/break → 继续
    if (focusPhase === "paused" || focusPhase === "break") focus.resume();
    else focus.start();
  };

  const begin = () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().then(() => setFull(true)).catch(() => {});
    }
    start();
  };

  // 关闭弹层 = 本次计时结束：清空状态机与持久化快照，下次打开从 idle 重新开始
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      sessionRef.current = null;
      setCelebration(null);
      resetFocusSession();
    }
    wasOpenRef.current = open;
  }, [open, resetFocusSession]);

  // 快捷开始：autoStart 时挂载后自动进入倒计时（仍允许暂停/结束）
  useEffect(() => {
    if (!open || !autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoStart]);

  const pause = () => {
    focus.pause();
  };

  const reset = () => {
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
    resetFocusSession();
  };

  const changePreset = (m: number) => {
    // 状态机负责目标时长 + 归零；已有未结算会话先 flush 一次
    focus.setMinutes(m);
    bg.setMinutes(m);
    exerciseRecordedRef.current = false;
    if (sessionRef.current && !sessionRef.current.settled) {
      void flushElapsed();
    }
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

  const recordBreakDone = async () => {
    await fetch("/api/wellbeing/breaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "MOVEMENT", minutes: 5 }),
    });
    setWbDone((s) => ({ ...s, break: true }));
    // S6-4：进入状态机的 break 阶段（结束页保持展示，休息完可「再来一次」继续）
    startBreakSession();
  };

  const recordWaterDone = async () => {
    await fetch("/api/wellbeing/hydration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMl: 250, source: "FOCUS_BREAK" }),
    });
    setWbDone((s) => ({ ...s, water: true }));
  };

  // 显示层：countdown 用剩余时间；stopwatch 用已跑秒数（状态机统一给出 remaining 语义与 ratio）
  const elapsed = timerMode === "stopwatch" ? remaining : total - remaining;
  const remainingShown = remaining;
  const sessionLabel = mode === "exercise" ? "运动中" : (task?.title ?? "自由专注");

  const settleAndClose = () => {
    if (sessionRef.current && !sessionRef.current.settled) void settleOnExit();
    onCloseRef.current();
  };

  const handleClose = () => {
    const el = currentElapsed();
    if (el >= MIN_FOCUS_SECONDS || running || (elapsed > 0 && mode === "focus")) void record(el);
    else onCloseRef.current();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-black/80">
      <FocusBackgroundLayer />
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
      <FocusTopBar
        full={full}
        onToggleFullscreen={toggleFullscreen}
        onToggleBackground={() => setShowBg((v) => !v)}
        onClose={handleClose}
      />

      {/* 背景设置面板 */}
      <FocusBackgroundPanel open={showBg} />

      {/* 主区域 */}
      {doneView ? (
        <CompletionPanel
          mode={mode}
          phase={focusPhase}
          elapsedSeconds={elapsed}
          wbDone={wbDone}
          onRecordBreak={recordBreakDone}
          onRecordWater={recordWaterDone}
          onGoEnergy={settleAndClose}
          onAgain={() => {
            reset();
            start();
          }}
          onBack={settleAndClose}
        />
      ) : started ? (
        <RunningScreen
          sessionLabel={sessionLabel}
          mode={mode}
          running={running}
          ratio={ratio}
          remainingSeconds={remainingShown}
          timerView={timerView}
          minutes={minutes}
          endDisabled={elapsed < 10 && mode === "focus" && timerMode === "countdown" && remaining === total}
          onToggleRun={() => (running ? pause() : start())}
          onReset={reset}
          onEnd={() => record(currentElapsed())}
          onChangeView={chooseTimerView}
          onPickPreset={changePreset}
        />
      ) : (
        <StartScreen
          sessionLabel={sessionLabel}
          mode={mode}
          timerMode={timerMode}
          minutes={minutes}
          onChangeTimerMode={changeTimerMode}
          onPickPreset={changePreset}
          onBegin={begin}
        />
      )}
    </div>
  );
}
