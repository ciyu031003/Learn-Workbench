import { Alert, Platform } from "react-native";
import * as Device from "expo-device";
import { getApiUrl } from "@/config";
import { APP_VERSION_CODE, APP_VERSION_NAME } from "./ota";
import { secureToken } from "./secure-token";
import { crashNative } from "./crash-native";
import {
  buildReportJson,
  fitToBudget,
  isCrashExit,
  pickCrashSnapshot,
  type DiagnosticInput,
  type ExitInfo,
} from "./crash-report";
import {
  getInstallId,
  getLastUploadedAt,
  isCaptureEnabled,
  markUploaded,
  readLastHeartbeat,
  readLastScreen,
  readSnapshot,
} from "./crash-capture";

/**
 * 诊断包：合并"崩溃前落盘的面包屑"与"下次启动从系统取回的崩溃栈"，然后上传（v1.32.0）。
 *
 * 上传**只由用户触发**（diagnostics 页的按钮，或崩溃后冷启动时的提示弹窗点"上传"）；
 * 没有任何后台静默上传，日志默认只在本机。
 */

export interface PendingCrash {
  /** 原生给出的上次退出记录（Android 11+；拿不到为 null） */
  exit: ExitInfo | null;
  /** 是否值得提示用户上传（真正的崩溃/ANR，且还没上传过） */
  shouldPrompt: boolean;
}

/** 上次异常退出是否还没上传过 */
export async function readPendingCrash(): Promise<PendingCrash> {
  const [exit, lastUploaded] = await Promise.all([crashNative.lastExitInfo(), getLastUploadedAt()]);
  const shouldPrompt = !!exit && isCrashExit(exit.reasonCode) && exit.timestamp > lastUploaded;
  return { exit, shouldPrompt };
}

/** 组装诊断包（原生栈 + logcat + 面包屑 + 设备信息） */
export async function collectDiagnostics(note?: string): Promise<DiagnosticInput> {
  // 快照读两份：current = 本次会话；previous = 启动时另存的**崩溃现场**（v1.32.0 首次上报就吃了这个亏：
  // 新会话立刻覆盖 latest.json，上传时只剩「/ → /today」两条，崩溃前的轨迹全丢）
  const [exit, logcat, current, previous, curHeartbeat, prevHeartbeat, screen, installId] = await Promise.all([
    crashNative.lastExitInfo(),
    crashNative.logcat(),
    readSnapshot("current"),
    readSnapshot("previous"),
    readLastHeartbeat("current"),
    readLastHeartbeat("previous"),
    readLastScreen(),
    getInstallId(),
  ]);
  const picked = pickCrashSnapshot(current, previous, exit);
  const usingCrashScene = picked.source === "crash";
  return {
    generatedAt: Date.now(),
    installId,
    app: {
      version: APP_VERSION_NAME,
      build: String(APP_VERSION_CODE),
      platform: Platform.OS + " " + String(Platform.Version),
      osVersion: String(Device.osVersion ?? ""),
      model: String(Device.modelName ?? ""),
      isDevice: !!Device.isDevice,
    },
    captureEnabled: isCaptureEnabled(),
    lastExit: exit,
    // 崩溃现场那份快照的心跳才有意义（本次会话的心跳一定晚于崩溃时刻）
    lastHeartbeatAt: usingCrashScene ? (prevHeartbeat ?? curHeartbeat) : curHeartbeat,
    lastScreen: picked.lastScreen ?? (usingCrashScene ? null : screen),
    crumbSource: picked.source,
    crumbs: picked.crumbs,
    jsErrors: (usingCrashScene ? previous?.jsErrors : current?.jsErrors) ?? [],
    logcat,
    note,
  };
}

/**
 * 客户端实际上限与 UTF-8 字节口径、体积兜底（fitToBudget）都在 crash-report.ts（纯函数、可单测）；
 * 这里只负责"收集 → 兜底 → 上传"。
 */

export type UploadResult = { ok: true; id: string | null } | { ok: false; error: string };

/**
 * 上传诊断包。
 * ⚠️ nginx 超限/网关错误会回 **HTML**（不是 JSON），所以先看 Content-Type 再解析（踩坑 90 的教训）。
 */
export async function uploadDiagnostics(note?: string): Promise<UploadResult> {
  try {
    const payload = buildReportJson(fitToBudget(await collectDiagnostics(note)));
    const token = await secureToken.loadWithTimeout(3000);
    const res = await fetch(getApiUrl() + "/api/diagnostics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(payload),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      if (type.includes("application/json")) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return { ok: false, error: body?.error ?? "上传失败（" + res.status + "）" };
      }
      return { ok: false, error: "上传失败（HTTP " + res.status + "，响应非 JSON）" };
    }
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    await markUploaded(Date.now());
    return { ok: true, id: body?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络异常" };
  }
}

/**
 * 冷启动时的"上次异常退出"提示（用户点上传才会上传）。
 * 只在原生明确给出 CRASH/CRASH_NATIVE/ANR/SIGNALED 且这次崩溃还没上传过时弹。
 */
export async function promptPendingCrash(): Promise<void> {
  try {
    const pending = await readPendingCrash();
    if (!pending.shouldPrompt) return;
    const where = (await readLastScreen()) ?? "未知页面";
    Alert.alert(
      "检测到上次异常退出",
      "原因：" + (pending.exit?.reason ?? "未知") + "\n最后页面：" + where + "\n\n现在上传诊断日志给开发者？（只包含本机日志，不含密码）",
      [
        { text: "稍后", style: "cancel" },
        {
          text: "上传",
          onPress: () => {
            void uploadDiagnostics("冷启动自动询问：上次异常退出").then((r) => {
              Alert.alert(r.ok ? "已上传" : "上传失败", r.ok ? "谢谢！日志已收到。" : r.error);
            });
          },
        },
      ]
    );
  } catch {
    // 提示失败绝不能影响启动
  }
}
