"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * 专注计时状态机（S6-4）。
 *
 * 设计目标：
 *  - **纯 TS 状态机 + 持久化**：reducer / 序列化 / 恢复函数都是纯函数，不碰 DOM、不依赖 React，
 *    Web 与移动端可以共用同一套状态机（移动端只需注入自己的 storage）。
 *  - **跨刷新恢复**：运行中每秒把 snapshot 写进 storage；刷新后按「墙钟差」补回已跑时长，
 *    不会因为刷新丢掉专注时间（服务端 flush 仍是最终事实，这里只兜住 UI 与未结算时长）。
 *  - **五态**：idle → running ⇄ paused，结束后 finished，休息阶段 break。
 *
 * 约定：
 *  - 所有耗时都用毫秒墙钟计算：state.elapsedMsBase（已冻结的累计）+ 当前运行段。
 *  - Date.now() 一律作为事件参数传入 reducer，便于单测控制时间。
 */

/** 单会话时长上限：与 lib/focus-session.ts 的 MAX_SESSION_SECONDS 对齐（12h）。 */
export const FOCUS_SESSION_MAX_SECONDS = 12 * 3600;

/** storage key 前缀；按 mode + task 区分，避免不同任务互相恢复。 */
export const FOCUS_SESSION_STORAGE_PREFIX = "lwb.focus.session.v1";

const SNAPSHOT_VERSION = 1;

export type FocusTimerMode = "countdown" | "stopwatch";

export type FocusPhase = "idle" | "running" | "paused" | "break" | "finished";

export interface FocusSessionState {
  phase: FocusPhase;
  mode: FocusTimerMode;
  /** 目标时长（秒）；stopwatch 模式下只用于展示，不封顶 */
  totalSeconds: number;
  /** 已冻结的累计毫秒（暂停/结束前折算进去的运行段） */
  elapsedMsBase: number;
  /** 当前运行段的墙钟起点；只有 running 时非 null */
  segmentStartedAtMs: number | null;
  /** 服务端幂等 client_id（开始计时时生成；刷新恢复后沿用） */
  sessionId: string | null;
  sessionStartedAt: string | null;
  /** 最近一次状态变化时间（用于恢复时的墙钟差） */
  updatedAtMs: number;
}

export interface FocusSessionSnapshot {
  version: number;
  mode: FocusTimerMode;
  taskId: number | null;
  phase: FocusPhase;
  totalSeconds: number;
  elapsedMs: number;
  segmentStartedAtMs: number | null;
  sessionId: string | null;
  sessionStartedAt: string | null;
  updatedAtMs: number;
}

export interface FocusSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CreateFocusSessionOptions {
  mode: FocusTimerMode;
  minutes: number;
  nowMs: number;
  sessionId?: string | null;
  sessionStartedAt?: string | null;
}

export type FocusSessionEvent =
  | { type: "START"; nowMs: number; sessionId?: string; sessionStartedAt?: string }
  | { type: "PAUSE"; nowMs: number }
  | { type: "RESUME"; nowMs: number }
  | { type: "FINISH"; nowMs: number }
  | { type: "TICK"; nowMs: number }
  | { type: "BREAK"; nowMs: number }
  | { type: "RESUME_FROM_BREAK"; nowMs: number }
  | { type: "RESET"; nowMs: number; totalSeconds?: number }
  | { type: "SET_MINUTES"; minutes: number; nowMs: number }
  | { type: "SET_MODE"; mode: FocusTimerMode; nowMs: number }
  | { type: "RESTORE"; state: FocusSessionState };

/* ------------------------------------------------------------------ */
/* 取值/校验（异常参数一律钳位，不让 NaN 进入状态机）                    */
/* ------------------------------------------------------------------ */

function toFiniteNumber(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** 秒数钳位到 [0, max]（NaN/负数 → 0） */
export function clampFocusSeconds(value: unknown, max = FOCUS_SESSION_MAX_SECONDS): number {
  const n = toFiniteNumber(value, 0);
  if (n <= 0) return 0;
  return Math.min(Math.round(n), Math.max(1, Math.round(max)));
}

/** 分钟 → 秒（非法输入回退 25 分钟） */
export function focusMinutesToSeconds(minutes: unknown): number {
  const m = toFiniteNumber(minutes, 25);
  if (m <= 0) return 25 * 60;
  return clampFocusSeconds(m * 60);
}

export function createFocusSessionState(options: CreateFocusSessionOptions): FocusSessionState {
  const totalSeconds = focusMinutesToSeconds(options.minutes);
  return {
    phase: "idle",
    mode: options.mode,
    totalSeconds,
    elapsedMsBase: 0,
    segmentStartedAtMs: null,
    sessionId: options.sessionId ?? null,
    sessionStartedAt: options.sessionStartedAt ?? null,
    updatedAtMs: toFiniteNumber(options.nowMs, 0),
  };
}

/** 当前已跑毫秒（含当前运行段），上限 12h */
export function focusElapsedMsAt(state: FocusSessionState, nowMs: number): number {
  const base = Math.max(0, state.elapsedMsBase);
  const running = state.phase === "running" && state.segmentStartedAtMs !== null
    ? Math.max(0, toFiniteNumber(nowMs, state.segmentStartedAtMs) - state.segmentStartedAtMs)
    : 0;
  return Math.min(FOCUS_SESSION_MAX_SECONDS * 1000, base + running);
}

export function focusElapsedSecondsAt(state: FocusSessionState, nowMs: number): number {
  return Math.round(focusElapsedMsAt(state, nowMs) / 1000);
}

/** 倒计时剩余秒数；stopwatch 返回已跑秒数（保持与旧组件 remaining 语义一致） */
export function focusRemainingSecondsAt(state: FocusSessionState, nowMs: number): number {
  const elapsed = focusElapsedSecondsAt(state, nowMs);
  if (state.mode === "stopwatch") return Math.min(elapsed, FOCUS_SESSION_MAX_SECONDS);
  return Math.max(0, state.totalSeconds - elapsed);
}

/** 圆环比例：倒计时为剩余占比（与旧 UI 一致）；秒表返回 0 */
export function focusProgressAt(state: FocusSessionState, nowMs: number): number {
  if (state.mode === "stopwatch") return 0;
  if (state.totalSeconds <= 0) return 0;
  return focusRemainingSecondsAt(state, nowMs) / state.totalSeconds;
}

export function isFocusFinishedAt(state: FocusSessionState, nowMs: number): boolean {
  if (state.phase === "finished") return true;
  if (state.phase !== "running") return false;
  if (state.mode === "stopwatch") return false;
  return focusElapsedSecondsAt(state, nowMs) >= state.totalSeconds;
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

/** 把当前运行段折算进累计（幂等：segment 已为 null 时不动） */
function foldRunningSegment(state: FocusSessionState, nowMs: number, targetPhase: FocusPhase): FocusSessionState {
  const runningMs = state.segmentStartedAtMs === null
    ? 0
    : Math.max(0, toFiniteNumber(nowMs, state.segmentStartedAtMs) - state.segmentStartedAtMs);
  const elapsed = Math.min(FOCUS_SESSION_MAX_SECONDS * 1000, Math.max(0, state.elapsedMsBase) + runningMs);
  return { ...state, elapsedMsBase: elapsed, segmentStartedAtMs: null, phase: targetPhase, updatedAtMs: toFiniteNumber(nowMs, state.updatedAtMs) };
}

function createSessionIdentity(nowMs: number): { sessionId: string; sessionStartedAt: string } {
  const stamp = Math.max(0, Math.floor(toFiniteNumber(nowMs, 0))).toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return {
    sessionId: `focus-${stamp}-${rand}`,
    sessionStartedAt: new Date(toFiniteNumber(nowMs, Date.now())).toISOString(),
  };
}

export function focusSessionReducer(state: FocusSessionState, event: FocusSessionEvent): FocusSessionState {
  switch (event.type) {
    case "START": {
      if (state.phase === "running") return state;
      const identity = event.sessionId && event.sessionStartedAt
        ? { sessionId: event.sessionId, sessionStartedAt: event.sessionStartedAt }
        : createSessionIdentity(event.nowMs);
      const restartAfterFinish = state.phase === "finished";
      return {
        ...state,
        phase: "running",
        // 完成后再开始 = 新的一轮：清空累计与旧 client_id
        elapsedMsBase: restartAfterFinish ? 0 : state.elapsedMsBase,
        segmentStartedAtMs: toFiniteNumber(event.nowMs, Date.now()),
        sessionId: restartAfterFinish ? identity.sessionId : state.sessionId ?? identity.sessionId,
        sessionStartedAt: restartAfterFinish ? identity.sessionStartedAt : state.sessionStartedAt ?? identity.sessionStartedAt,
        updatedAtMs: toFiniteNumber(event.nowMs, Date.now()),
      };
    }
    case "PAUSE":
      if (state.phase !== "running") return state;
      return foldRunningSegment(state, event.nowMs, "paused");
    case "RESUME":
      if (state.phase !== "paused" && state.phase !== "break") return state;
      return {
        ...state,
        phase: "running",
        segmentStartedAtMs: toFiniteNumber(event.nowMs, Date.now()),
        updatedAtMs: toFiniteNumber(event.nowMs, Date.now()),
      };
    case "BREAK":
      // 允许 running/paused/finished → break（完成页点「记录休息」进入休息阶段）
      if (state.phase !== "running" && state.phase !== "paused" && state.phase !== "finished") return state;
      return foldRunningSegment(state, event.nowMs, "break");
    case "RESUME_FROM_BREAK":
      if (state.phase !== "break") return state;
      return {
        ...state,
        phase: "running",
        segmentStartedAtMs: toFiniteNumber(event.nowMs, Date.now()),
        updatedAtMs: toFiniteNumber(event.nowMs, Date.now()),
      };
    case "FINISH": {
      if (state.phase === "finished") return state;
      const folded = state.phase === "running" ? foldRunningSegment(state, event.nowMs, "finished") : { ...state, phase: "finished" as FocusPhase, segmentStartedAtMs: null };
      const capped = state.mode === "countdown"
        ? Math.min(folded.elapsedMsBase, state.totalSeconds * 1000)
        : folded.elapsedMsBase;
      return { ...folded, elapsedMsBase: capped, phase: "finished", updatedAtMs: toFiniteNumber(event.nowMs, folded.updatedAtMs) };
    }
    case "TICK": {
      if (!isFocusFinishedAt(state, event.nowMs)) return state;
      // 倒计时自然结束：冻结在目标时长，交给 FINISH 的展示逻辑
      return {
        ...state,
        phase: "finished",
        elapsedMsBase: state.mode === "countdown" ? state.totalSeconds * 1000 : Math.min(focusElapsedMsAt(state, event.nowMs), FOCUS_SESSION_MAX_SECONDS * 1000),
        segmentStartedAtMs: null,
        updatedAtMs: toFiniteNumber(event.nowMs, state.updatedAtMs),
      };
    }
    case "RESET":
      return createFocusSessionState({
        mode: state.mode,
        minutes: (event.totalSeconds ?? state.totalSeconds) / 60,
        nowMs: event.nowMs,
      });
    case "SET_MINUTES": {
      const totalSeconds = focusMinutesToSeconds(event.minutes);
      return {
        ...state,
        totalSeconds,
        elapsedMsBase: 0,
        segmentStartedAtMs: null,
        phase: state.phase === "idle" ? "idle" : "paused",
        updatedAtMs: toFiniteNumber(event.nowMs, state.updatedAtMs),
      };
    }
    case "SET_MODE":
      if (state.phase === "running") return { ...state, mode: event.mode, updatedAtMs: toFiniteNumber(event.nowMs, state.updatedAtMs) };
      return {
        ...state,
        mode: event.mode,
        elapsedMsBase: 0,
        segmentStartedAtMs: null,
        updatedAtMs: toFiniteNumber(event.nowMs, state.updatedAtMs),
      };
    case "RESTORE":
      return event.state;
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* 持久化 / 恢复（纯函数，storage 由调用方注入）                         */
/* ------------------------------------------------------------------ */

export function focusStorageKey(mode: FocusTimerMode, taskId: number | null | undefined): string {
  return `${FOCUS_SESSION_STORAGE_PREFIX}:${mode}:${taskId ?? "free"}`;
}

export function serializeFocusSession(state: FocusSessionState, nowMs: number, taskId: number | null): FocusSessionSnapshot {
  const at = toFiniteNumber(nowMs, Date.now());
  return {
    version: SNAPSHOT_VERSION,
    mode: state.mode,
    taskId,
    phase: state.phase,
    totalSeconds: state.totalSeconds,
    elapsedMs: focusElapsedMsAt(state, at),
    segmentStartedAtMs: state.segmentStartedAtMs,
    sessionId: state.sessionId,
    sessionStartedAt: state.sessionStartedAt,
    updatedAtMs: at,
  };
}

export interface RestoreFocusSessionOptions {
  nowMs: number;
  mode: FocusTimerMode;
  taskId: number | null;
  maxSeconds?: number;
}

/**
 * 解析并恢复 snapshot。
 * 返回 null 表示：没有快照 / JSON 损坏 / 版本不符 / 模式或任务不匹配 / 超过 12h 的陈旧快照。
 * 运行中的快照按墙钟差补回时长并继续运行（刷新恢复的关键）。
 */
export function restoreFocusSession(raw: string | null | undefined, options: RestoreFocusSessionOptions): FocusSessionState | null {
  if (!raw) return null;
  const maxSeconds = options.maxSeconds ?? FOCUS_SESSION_MAX_SECONDS;
  const nowMs = toFiniteNumber(options.nowMs, Date.now());
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const snap = parsed as Partial<FocusSessionSnapshot>;
  if (snap.version !== SNAPSHOT_VERSION) return null;
  if (snap.mode !== options.mode) return null;
  if ((snap.taskId ?? null) !== (options.taskId ?? null)) return null;
  const phases: FocusPhase[] = ["idle", "running", "paused", "break", "finished"];
  if (!snap.phase || !phases.includes(snap.phase)) return null;
  const updatedAtMs = toFiniteNumber(snap.updatedAtMs, NaN);
  if (!Number.isFinite(updatedAtMs)) return null;
  const ageMs = nowMs - updatedAtMs;
  if (ageMs < 0) return null; // 时钟回拨/未来快照：不信任
  if (ageMs > maxSeconds * 1000) return null; // 超过单会话上限：视为过期
  const totalSeconds = clampFocusSeconds(snap.totalSeconds, maxSeconds);
  const savedElapsedMs = Math.max(0, Math.min(toFiniteNumber(snap.elapsedMs, 0), maxSeconds * 1000));
  const recoveredMs = snap.phase === "running"
    ? Math.min(maxSeconds * 1000, savedElapsedMs + ageMs)
    : savedElapsedMs;

  let phase = snap.phase;
  if (snap.mode === "countdown" && phase === "running" && recoveredMs >= totalSeconds * 1000) phase = "finished";

  return {
    phase,
    mode: snap.mode,
    totalSeconds,
    elapsedMsBase: phase === "finished" && snap.mode === "countdown" ? totalSeconds * 1000 : recoveredMs,
    segmentStartedAtMs: phase === "running" ? nowMs : null,
    sessionId: typeof snap.sessionId === "string" ? snap.sessionId : null,
    sessionStartedAt: typeof snap.sessionStartedAt === "string" ? snap.sessionStartedAt : null,
    updatedAtMs: nowMs,
  };
}

export function loadFocusSession(
  storage: FocusSessionStorage | null | undefined,
  key: string,
  options: RestoreFocusSessionOptions
): FocusSessionState | null {
  if (!storage) return null;
  try {
    return restoreFocusSession(storage.getItem(key), options);
  } catch {
    return null;
  }
}

export function saveFocusSession(
  storage: FocusSessionStorage | null | undefined,
  key: string,
  state: FocusSessionState,
  nowMs: number,
  taskId: number | null
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(serializeFocusSession(state, nowMs, taskId)));
  } catch {
    // 隐私模式/配额满：恢复能力降级，不影响计时
  }
}

export function clearFocusSession(storage: FocusSessionStorage | null | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // 忽略
  }
}

function defaultStorage(): FocusSessionStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* React hook（Web 端薄封装；纯逻辑都在上面的函数里）                    */
/* ------------------------------------------------------------------ */

export interface UseFocusSessionOptions {
  /** 弹层是否打开；关闭时暂停 interval（状态仍保留到 reset/结算） */
  open: boolean;
  mode: FocusTimerMode;
  taskId: number | null;
  initialMinutes?: number;
  maxSeconds?: number;
  /** 可注入 storage（移动端/测试）；缺省 window.localStorage */
  storage?: FocusSessionStorage | null;
}

export interface UseFocusSessionApi {
  state: FocusSessionState;
  phase: FocusPhase;
  running: boolean;
  paused: boolean;
  started: boolean;
  finished: boolean;
  mode: FocusTimerMode;
  minutes: number;
  total: number;
  remaining: number;
  elapsed: number;
  ratio: number;
  sessionId: string | null;
  sessionStartedAt: string | null;
  elapsedSeconds: (nowMs?: number) => number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  startBreak: () => void;
  resumeFromBreak: () => void;
  reset: (totalSeconds?: number) => void;
  setMinutes: (minutes: number) => void;
  setMode: (mode: FocusTimerMode) => void;
  /** 显式把当前状态写盘（pagehide/visibilitychange 用） */
  persistNow: () => void;
}

export function useFocusSession(options: UseFocusSessionOptions): UseFocusSessionApi {
  const { open, mode, taskId, initialMinutes = 25, maxSeconds = FOCUS_SESSION_MAX_SECONDS } = options;
  // storage 在挂载时确定（window.localStorage 或注入的测试/移动端实现），之后不随渲染变化
  const [storage] = useState<FocusSessionStorage | null>(() =>
    options.storage === undefined ? defaultStorage() : options.storage
  );
  const key = focusStorageKey(mode, taskId);
  const [state, setState] = useState<FocusSessionState>(() =>
    createFocusSessionState({ mode, minutes: initialMinutes, nowMs: Date.now() })
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const restoredRef = useRef(false);
  const liveStateRef = useRef(state);
  // 事件回调里读最新状态用 ref；写入放在 effect 中（不在 render 期间改 ref）
  useEffect(() => {
    liveStateRef.current = state;
  }, [state]);

  const dispatch = useCallback((event: FocusSessionEvent) => {
    setState((prev) => focusSessionReducer(prev, event));
    setNowMs(toFiniteNumber((event as { nowMs?: number }).nowMs, Date.now()));
  }, []);

  // 打开时恢复一次（跨刷新）；快照按 mode+taskId 隔离，异常/过期快照直接忽略
  useEffect(() => {
    if (!open || restoredRef.current) return;
    restoredRef.current = true;
    const restored = loadFocusSession(storage, key, { nowMs: Date.now(), mode, taskId, maxSeconds });
    if (!restored) return;
    // 延后一拍写入，避免 effect 内同步 setState 触发级联渲染（恢复只发生一次）
    const timer = window.setTimeout(() => {
      setState(restored);
      setNowMs(Date.now());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, storage, key, mode, taskId, maxSeconds]);

  // 运行中每秒推进（只在打开时跑；页面关闭由 pagehide 写盘兜底）
  useEffect(() => {
    if (!open || state.phase !== "running") return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setState((prev) => focusSessionReducer(prev, { type: "TICK", nowMs: now }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, state.phase]);

  // 状态/秒针变化即写盘：刷新最多丢 1s
  useEffect(() => {
    if (!open) return;
    saveFocusSession(storage, key, state, nowMs, taskId);
  }, [open, storage, key, state, nowMs, taskId]);

  const persistNow = useCallback(() => {
    saveFocusSession(storage, key, liveStateRef.current, Date.now(), taskId);
  }, [storage, key, taskId]);

  const start = useCallback(() => dispatch({ type: "START", nowMs: Date.now() }), [dispatch]);
  const pause = useCallback(() => dispatch({ type: "PAUSE", nowMs: Date.now() }), [dispatch]);
  const resume = useCallback(() => dispatch({ type: "RESUME", nowMs: Date.now() }), [dispatch]);
  const finish = useCallback(() => dispatch({ type: "FINISH", nowMs: Date.now() }), [dispatch]);
  const startBreak = useCallback(() => dispatch({ type: "BREAK", nowMs: Date.now() }), [dispatch]);
  const resumeFromBreak = useCallback(() => dispatch({ type: "RESUME_FROM_BREAK", nowMs: Date.now() }), [dispatch]);
  const reset = useCallback((totalSeconds?: number) => {
    dispatch({ type: "RESET", nowMs: Date.now(), totalSeconds });
    clearFocusSession(storage, key);
  }, [dispatch, storage, key]);
  const setMinutes = useCallback((minutes: number) => dispatch({ type: "SET_MINUTES", minutes, nowMs: Date.now() }), [dispatch]);
  const setMode = useCallback((next: FocusTimerMode) => dispatch({ type: "SET_MODE", mode: next, nowMs: Date.now() }), [dispatch]);
  const elapsedSeconds = useCallback((at?: number) => focusElapsedSecondsAt(liveStateRef.current, at ?? Date.now()), []);

  const elapsed = focusElapsedSecondsAt(state, nowMs);
  const remaining = focusRemainingSecondsAt(state, nowMs);
  const ratio = focusProgressAt(state, nowMs);

  return useMemo(() => ({
    state,
    phase: state.phase,
    running: state.phase === "running",
    paused: state.phase === "paused",
    started: state.phase !== "idle",
    finished: state.phase === "finished",
    mode: state.mode,
    minutes: Math.round(state.totalSeconds / 60),
    total: state.totalSeconds,
    remaining,
    elapsed,
    ratio,
    sessionId: state.sessionId,
    sessionStartedAt: state.sessionStartedAt,
    elapsedSeconds,
    start, pause, resume, finish, startBreak, resumeFromBreak, reset, setMinutes, setMode, persistNow,
  }), [state, remaining, elapsed, ratio, elapsedSeconds, start, pause, resume, finish, startBreak, resumeFromBreak, reset, setMinutes, setMode, persistNow]);
}
