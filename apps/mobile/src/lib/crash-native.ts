import { NativeModules, Platform } from "react-native";
import type { ExitInfo } from "./crash-report";

/**
 * 原生 CrashLog 模块的 JS 包装（v1.32.0）。
 *
 * 原生实现：`apps/mobile/native/android/app/src/main/java/com/yuanabd/learnworkbench/CrashLogModule.kt`
 * （由 `scripts/apply-android-native.mjs` 落进 android/ 并在 MainApplication 注册，
 * 与 FocusTimerPackage 同一套手写原生链路，不走 prebuild）。
 *
 * 为什么必须走原生：**闪退是进程级死亡，崩溃时 JS 已经没了**，
 * 唯一能在"下次启动"拿到 native 崩溃栈的公开 API 是 Android 11+ 的
 * ActivityManager.getHistoricalProcessExitReasons() → getTraceInputStream()（无需 root）。
 *
 * 所有调用都有兜底：模块缺失（旧包 / iOS / 模拟器）时返回 null / 空串，绝不抛。
 */
interface CrashLogNativeModule {
  /** 返回最近一次进程退出记录（无记录返回 null） */
  getLastExitInfo(): Promise<Partial<ExitInfo> | null>;
  /** 应用自身可见的 logcat（Android 4.1+ 只能读到自己 uid 的日志） */
  dumpLogcat(maxBytes: number): Promise<string>;
}

const native = (NativeModules as unknown as { CrashLog?: CrashLogNativeModule }).CrashLog;

export const crashNative = {
  /** 原生通道是否可用（决定 diagnostics 页怎么显示"上次退出"） */
  get available(): boolean {
    return Platform.OS === "android" && !!native;
  },

  async lastExitInfo(): Promise<ExitInfo | null> {
    if (!native) return null;
    try {
      const raw = await native.getLastExitInfo();
      if (!raw) return null;
      return {
        reason: String(raw.reason ?? "UNKNOWN"),
        reasonCode: Number(raw.reasonCode ?? -1),
        timestamp: Number(raw.timestamp ?? 0),
        description: String(raw.description ?? ""),
        trace: String(raw.trace ?? ""),
      };
    } catch {
      return null;
    }
  },

  async logcat(maxBytes = 256 * 1024): Promise<string> {
    if (!native) return "";
    try {
      return String((await native.dumpLogcat(maxBytes)) ?? "");
    } catch {
      return "";
    }
  },
};
