import { create } from "zustand";

export type FocusTimerMode = "countdown" | "stopwatch";
export type FocusSessionMode = "focus" | "exercise";
export type FocusRunStatus = "idle" | "running" | "paused" | "done";

export interface FocusTaskRef {
  id: number | null;
  title: string | null;
}

/** 打开一次专注所需的配置（由 today / tasks 等入口写入） */
export interface FocusOpenConfig {
  task: FocusTaskRef | null;
  autoStart?: boolean;
  initialTimerMode?: FocusTimerMode;
  initialMinutes?: number;
  mode?: FocusSessionMode;
  exerciseLabel?: string | null;
  contentLabel?: string | null;
  /** 运动模式：结束时回写 addSportSeconds 用 */
  sportKey?: string | null;
}

/** 全屏计时向悬浮计时广播的最小快照 */
export interface FocusSnapshot {
  status: FocusRunStatus;
  remainingSeconds: number;
  totalSeconds: number;
  timerMode: FocusTimerMode;
  taskTitle: string | null;
  sessionMode: FocusSessionMode;
  updatedAt: number;
}

export interface FocusSessionStore {
  /** 会话是否处于活跃状态（最小化时为 true，关闭时为 false） */
  open: boolean;
  /** 全屏是否收起为悬浮计时 */
  minimized: boolean;
  /** 每次新开会话 +1；根级 FocusTimer 用它做 key，最小化/恢复不重挂载 */
  sessionKey: number;
  config: FocusOpenConfig | null;
  snapshot: FocusSnapshot | null;
  openFocus: (config: FocusOpenConfig) => void;
  minimize: () => void;
  restore: () => void;
  close: () => void;
  setSnapshot: (snapshot: FocusSnapshot | null) => void;
}

export const initialFocusSessionState: Pick<
  FocusSessionStore,
  "open" | "minimized" | "sessionKey" | "config" | "snapshot"
> = {
  open: false,
  minimized: false,
  sessionKey: 0,
  config: null,
  snapshot: null,
};

/**
 * 全局专注会话（只存“开/收起/快照”，计时引擎仍在 FocusTimer 内）。
 * 根级只挂一个 FocusTimer，today/tasks 只负责 openFocus(config)，
 * 因此跨 Tab / 子页都不会出现两个计时器抢恢复标记的问题。
 */
export const useFocusSessionStore = create<FocusSessionStore>((set) => ({
  ...initialFocusSessionState,
  openFocus: (config) =>
    set((state) => {
      // 同时只允许一个专注会话：已有会话时只恢复全屏，绝不复位当前计时
      if (state.open) return { minimized: false };
      return {
        open: true,
        minimized: false,
        sessionKey: state.sessionKey + 1,
        config,
        snapshot: null,
      };
    }),
  minimize: () => set((state) => (state.open ? { minimized: true } : {})),
  restore: () => set((state) => (state.open ? { minimized: false } : {})),
  close: () =>
    set({
      open: false,
      minimized: false,
      config: null,
      snapshot: null,
    }),
  setSnapshot: (snapshot) => set({ snapshot }),
}));
