import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 「计时中途退出也要记上」的恢复逻辑（v1.44.2 真机反馈）。
 *
 * 用户原话：「计时的时候，不单单点击"记住本次记录"那个按钮才能记录时间。
 * 我退出去，也能自动记录我计时了多久。」
 *
 * 原先只有三条路径会落库：点「结束并记录」、倒计时自然结束、Android 返回键
 * （Modal 的 onRequestClose）。**把 App 划掉 / 进程被杀**时，计时状态只在内存里，
 * 那一段专注就彻底丢了。
 *
 * 做法：计时真正开始的那一刻把「运行中会话」写进 AsyncStorage；正常记录/重置时清掉。
 * 下次冷启动时若读到残留标记，说明上次是被中断的 —— 按墙钟差补记一次。
 */

export const RUNNING_FOCUS_KEY = "lwb.focus.running.v1";

/**
 * 中途退出后最多按多久补记。
 * 防止一个忘了关的计时器在几天后补出几百小时；12 小时也远超任何单次专注。
 */
export const MAX_RECOVER_SECONDS = 12 * 3600;

/**
 * 少于这个秒数不补记，与 focus-timer 里 `elapsedSeconds < 10` 的既有丢弃口径一致 ——
 * 免得"点开看了一眼就退出"也生成一条 0 分钟的记录。
 */
export const MIN_RECOVER_SECONDS = 10;

export interface RunningFocusSession {
  /** 计时开始（或最后一次恢复运行）的墙钟时间，epoch ms */
  startedAt: number;
  /** focus = 写专注 sessions；exercise = 交给运动记录通道 */
  sessionMode: "focus" | "exercise";
  kind: "countdown" | "stopwatch";
  /** 倒计时计划时长（秒）；stopwatch 传 0 */
  plannedSeconds: number;
  taskId: number | null;
  contentLabel: string | null;
  exerciseLabel: string | null;
}

/**
 * 纯函数：给定被中断的会话与"现在"，算出应补记多少秒。
 * 返回 0 表示不该补记（太短 / 时间异常）。
 */
export function recoveredSeconds(session: RunningFocusSession, now: number): number {
  const raw = Math.floor((now - session.startedAt) / 1000);
  if (!Number.isFinite(raw) || raw < MIN_RECOVER_SECONDS) return 0;
  const capped = Math.min(raw, MAX_RECOVER_SECONDS);
  // 倒计时最多记到计划时长：用户设了 25 分钟却让它在后台躺了 3 小时，
  // 记成 25 分钟才是"这次专注了多久"的真实语义
  if (session.kind === "countdown" && session.plannedSeconds > 0) {
    return Math.min(capped, session.plannedSeconds);
  }
  return capped;
}

export async function saveRunningFocus(session: RunningFocusSession): Promise<void> {
  try {
    await AsyncStorage.setItem(RUNNING_FOCUS_KEY, JSON.stringify(session));
  } catch {
    // 存储失败不影响计时本身
  }
}

export async function clearRunningFocus(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RUNNING_FOCUS_KEY);
  } catch {
    // 忽略
  }
}

/** 读取残留的"运行中会话"；解析失败或字段不合法时返回 null 并顺手清掉 */
export async function loadRunningFocus(): Promise<RunningFocusSession | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(RUNNING_FOCUS_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<RunningFocusSession>;
    if (
      typeof v?.startedAt !== "number" ||
      !Number.isFinite(v.startedAt) ||
      (v.sessionMode !== "focus" && v.sessionMode !== "exercise") ||
      (v.kind !== "countdown" && v.kind !== "stopwatch")
    ) {
      await clearRunningFocus();
      return null;
    }
    return {
      startedAt: v.startedAt,
      sessionMode: v.sessionMode,
      kind: v.kind,
      plannedSeconds: typeof v.plannedSeconds === "number" ? v.plannedSeconds : 0,
      taskId: typeof v.taskId === "number" ? v.taskId : null,
      contentLabel: typeof v.contentLabel === "string" ? v.contentLabel : null,
      exerciseLabel: typeof v.exerciseLabel === "string" ? v.exerciseLabel : null,
    };
  } catch {
    await clearRunningFocus();
    return null;
  }
}
