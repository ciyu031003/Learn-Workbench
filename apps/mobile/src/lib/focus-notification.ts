import { NativeModules, PermissionsAndroid, Platform } from "react-native";

/**
 * 专注计时的**前台服务常驻通知**（v12 P0-8）。
 *
 * 通知由原生画（FocusTimerService + notification_focus.xml）：
 * 左侧是圆环（倒计时按剩余、正计时按已用），右侧是当前任务 / 习惯名与时间。
 * 这里只做三件事：请求通知权限、把参数交给原生、结束时收掉。
 *
 * 设计约束：
 *  - **原生模块缺失时全部静默 no-op**（iOS / 老包 / 未注册都不该崩）；
 *  - 计时参数用「虚拟起点」传：startAtMs = Date.now() - 已跑毫秒，
 *    这样原生按 now - startAtMs 算出来的时长与 App 内完全一致（暂停段不计入）；
 *  - 不在这里做任何计时逻辑 —— 单一事实源仍是 focus-elapsed.ts。
 */
export type FocusNotificationMode = "countdown" | "stopwatch";

interface FocusTimerNative {
  start(title: string, mode: string, totalMs: number, startAtMs: number): void;
  stop(): void;
}

function nativeModule(): FocusTimerNative | null {
  const n = (NativeModules as unknown as { FocusTimer?: FocusTimerNative }).FocusTimer;
  return n && typeof n.start === "function" ? n : null;
}

/** 当前平台/包是否支持常驻通知 */
export function focusNotificationSupported(): boolean {
  return Platform.OS === "android" && nativeModule() !== null;
}

let askedPermission = false;
/** Android 13+ 需要 POST_NOTIFICATIONS 运行时权限（拒绝也不影响服务本身，只是看不到通知） */
async function ensureNotificationPermission(): Promise<void> {
  if (Platform.OS !== "android" || askedPermission) return;
  askedPermission = true;
  const version = Number(Platform.Version);
  if (!Number.isFinite(version) || version < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // 用户拒绝 / 系统不支持：忽略，服务照常跑
  }
}

export interface FocusNotificationInput {
  /** 通知右侧显示的名字（任务标题 / 习惯名 / 运动名） */
  title: string;
  mode: FocusNotificationMode;
  /** 倒计时总时长（毫秒）；正向计时传已设目标或 0 */
  totalMs: number;
  /** 已跑毫秒（用于换算虚拟起点） */
  elapsedMs: number;
}

/** 开始 / 刷新常驻通知（可重复调用：暂停后再继续、切换任务） */
export async function startFocusNotification(input: FocusNotificationInput): Promise<void> {
  const native = nativeModule();
  if (!native) return;
  await ensureNotificationPermission();
  try {
    const elapsed = Math.max(0, Math.round(input.elapsedMs));
    native.start(input.title, input.mode, Math.max(0, Math.round(input.totalMs)), Date.now() - elapsed);
  } catch {
    // 原生异常不影响 App 内计时
  }
}

/** 收掉常驻通知（暂停 / 结束 / 关闭弹层时调用） */
export function stopFocusNotification(): void {
  const native = nativeModule();
  if (!native || typeof native.stop !== "function") return;
  try {
    native.stop();
  } catch {
    // 忽略
  }
}
