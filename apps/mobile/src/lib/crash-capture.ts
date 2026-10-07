import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { CRUMB_LIMIT, isCrashExit, pushCrumb, type Crumb, type CrumbSnapshot, type JsErrorInfo } from "./crash-report";
import { crashNative } from "./crash-native";

/**
 * 崩溃取证 —— **崩溃前持续落盘**那一半（v1.32.0）。
 *
 * 为什么不是"崩溃时保存这一段"：闪退是**进程级死亡**，崩溃瞬间 JS 线程已经没了，
 * ErrorUtils / try-catch 都拦不到，写文件更没机会。所以做法是：
 *   1. 面包屑（页面 / 滚动区间 / 操作 / 请求结果）持续写进本机 `diag/latest.json`（防抖 400ms + 心跳 5s 兜底）；
 *   2. 进程被杀后**下次冷启动**：先把上一份快照另存为 `previous.json`（**崩溃现场**），再开始记新会话；
 *   3. 原生模块（Android 11+ ApplicationExitInfo）取回崩溃栈；
 *   4. 三者在 diagnostics 页合并成诊断包，**由用户点一下上传**（默认不自动上传）。
 *
 * ⚠️ v1.32.0 首次真机上报暴露的两个自身缺陷（已修）：
 *   - 冷启动后新会话**立刻覆盖** latest.json → 上传时只剩「/ → /today」两条新会话面包屑；
 *     现在启动时先 preserve 成 previous.json（仅当原生判定上次确实是崩溃），上传时优先用崩溃现场那份。
 *   - logcat 取头部 → 把尾部真正致命的 FATAL EXCEPTION 截掉；现在统一取尾部（crash-report.clampTail）。
 *
 * 隐私：面包屑只写本机私有目录（documentDirectory），**任何数据都不会自己离开设备**；
 * 上传前在 crash-report.ts 里统一脱敏（Bearer / cookie / 邮箱 / 手机号 / 长随机串）。
 *
 * 踩坑 48/89：本文件 import 了 react-native，**不要写单测**；纯逻辑都在 crash-report.ts。
 */

const ENABLED_KEY = "lwb_diag_enabled";
const INSTALL_KEY = "lwb_diag_install_id";
const LAST_UPLOAD_KEY = "lwb_diag_last_upload";
const LAST_SCREEN_KEY = "lwb_diag_last_screen";

const DIR = (LegacyFileSystem.documentDirectory ?? LegacyFileSystem.cacheDirectory ?? "") + "diag/";
const LATEST_FILE = DIR + "latest.json";
const LATEST_TMP = DIR + "latest.json.tmp";
const PREV_FILE = DIR + "previous.json";
const HEARTBEAT_FILE = DIR + "heartbeat.json";
const PREV_HEARTBEAT_FILE = DIR + "previous-heartbeat.json";

/**
 * 心跳间隔：崩溃后"最后心跳时间"就是崩溃时刻的下界。
 * v1.35.0 由 5s 放宽到 30s（2026-10-07 二轮评审）：5s 心跳 × 每次写 latest.json + heartbeat.json
 * 两个文件 = 前台每小时 ~720 次重复写盘，服务的只是极少数排障会话。30s 仍是
 * crash-report.HEARTBEAT_STALE_MS(90s) 的 1/3，"非正常退出"判据不受影响；
 * 没有新面包屑时只续 heartbeat.json（十几字节），不再重写整个快照。
 */
const HEARTBEAT_INTERVAL_MS = 30000;
/** 面包屑写盘防抖：太频繁会拖慢滚动，太稀疏会丢现场 */
const FLUSH_DEBOUNCE_MS = 400;
/** 同类高频面包屑的最小间隔（滚动事件每帧都来） */
const SCROLL_CRUMB_MIN_GAP_MS = 800;
const JS_ERROR_LIMIT = 20;
/** 快照时间与崩溃时刻的允许误差（ms）：快照一定略早于崩溃 */
const CRASH_SCENE_SLACK_MS = 5000;

interface SnapshotFile extends CrumbSnapshot {
  v: 1;
  jsErrors: JsErrorInfo[];
}

let installed = false;
let enabled = true;
let crumbs: Crumb[] = [];
let jsErrors: JsErrorInfo[] = [];
let lastScreen: string | null = null;
let lastScrollCrumbAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let writing = false;
let pendingWrite = false;
/** 启动引导（建目录 + 另存崩溃现场）完成前不写盘，避免把上一份快照覆盖掉 */
let ready: Promise<void> | null = null;
/**
 * v1.35.0：App 是否在前台。由 `_layout.tsx` 的 AppState 监听驱动（本文件**不 import react-native**，
 * 踩坑 60/89 —— import 了 RN 的文件不能进单测/会拖垮整份 suite）。后台不写心跳：
 * Android 冻结进程后定时器本来就不跑，主动停写还能省掉"冻结前最后几秒"的无谓写盘。
 */
let appStateActive = true;
/** 上次写盘后有没有新面包屑/JS 错误（没有就只续心跳文件，不重写快照） */
let dirtySinceWrite = true;

function now(): number {
  return Date.now();
}

function serialize(): SnapshotFile {
  return { v: 1, crumbs, jsErrors, lastScreen, updatedAt: now() };
}

async function ensureDir(): Promise<void> {
  if (!DIR) return;
  try {
    const info = await LegacyFileSystem.getInfoAsync(DIR);
    if (!info.exists) await LegacyFileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {
    // 目录建不出来（存储不可用）：取证静默失效，不影响主流程
  }
}

async function readSnapshotFile(file: string): Promise<SnapshotFile | null> {
  try {
    const info = await LegacyFileSystem.getInfoAsync(file);
    if (!info.exists) return null;
    const parsed = JSON.parse(await LegacyFileSystem.readAsStringAsync(file, { encoding: "utf8" })) as SnapshotFile;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.crumbs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 冷启动时把"上一份快照"另存为 previous.json —— **这是崩溃现场**。
 *
 * 只在原生明确判定上次退出是崩溃（SIGNALED/CRASH/CRASH_NATIVE/ANR）时才另存，
 * 避免正常重开 App 把真正的崩溃现场覆盖掉；同一现场不重复覆盖（比对 updatedAt）。
 */
async function preservePreviousSnapshot(): Promise<void> {
  try {
    const exit = await crashNative.lastExitInfo();
    if (!exit || !isCrashExit(exit.reasonCode)) return;
    const latest = await readSnapshotFile(LATEST_FILE);
    if (!latest) return;
    // 快照应略早于崩溃时刻；差太多说明这份快照不是那次崩溃的现场
    if (latest.updatedAt > exit.timestamp + CRASH_SCENE_SLACK_MS) return;
    const prev = await readSnapshotFile(PREV_FILE);
    if (prev && latest.updatedAt <= prev.updatedAt) return;
    await LegacyFileSystem.copyAsync({ from: LATEST_FILE, to: PREV_FILE });
    const hb = await LegacyFileSystem.getInfoAsync(HEARTBEAT_FILE);
    if (hb.exists) await LegacyFileSystem.copyAsync({ from: HEARTBEAT_FILE, to: PREV_HEARTBEAT_FILE });
  } catch {
    // 另存失败：只是没有崩溃现场，不影响主流程
  }
}

/** 心跳文件只承载"进程还活着"这一个信号（十几字节），与快照解耦 —— 心跳可以高频续，快照只在有新内容时写 */
async function writeHeartbeat(): Promise<void> {
  if (!DIR) return;
  try {
    await LegacyFileSystem.writeAsStringAsync(HEARTBEAT_FILE, String(now()), { encoding: "utf8" });
  } catch {
    // 写失败不抛：取证是"尽力而为"
  }
}

/** 原子写：先写 .tmp 再 move，避免崩溃恰好发生在写一半留下坏 JSON */
async function writeSnapshot(): Promise<void> {
  if (!DIR) return;
  if (ready) await ready;
  if (writing) {
    pendingWrite = true;
    return;
  }
  writing = true;
  try {
    const body = JSON.stringify(serialize());
    await LegacyFileSystem.writeAsStringAsync(LATEST_TMP, body, { encoding: "utf8" });
    await LegacyFileSystem.moveAsync({ from: LATEST_TMP, to: LATEST_FILE });
    dirtySinceWrite = false;
    await writeHeartbeat();
  } catch {
    // 写失败不抛：取证是"尽力而为"，绝不能让拿日志这件事本身把 App 弄崩
  } finally {
    writing = false;
    if (pendingWrite) {
      pendingWrite = false;
      void writeSnapshot();
    }
  }
}

function scheduleFlush(delay = FLUSH_DEBOUNCE_MS): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void writeSnapshot();
  }, delay);
}

/** 立刻落盘（fatal 错误路径用：进程可能马上就没） */
export function flushNow(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  void writeSnapshot();
}

// ---------------------------------------------------------------- 开关

export async function loadCaptureEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ENABLED_KEY);
    enabled = v === null ? true : v === "1";
  } catch {
    enabled = true;
  }
  return enabled;
}

export function isCaptureEnabled(): boolean {
  return enabled;
}

export async function setCaptureEnabled(next: boolean): Promise<void> {
  enabled = next;
  try {
    await AsyncStorage.setItem(ENABLED_KEY, next ? "1" : "0");
  } catch {
    // 忽略
  }
  if (next) {
    recordCrumb("lifecycle", { event: "capture-on" });
  } else {
    // v1.35.0（2026-10-07 二轮评审 B-6）：**关记录 ≠ 清现场**。
    // 崩溃现场（previous.json / previous-heartbeat.json）必须保留 —— 用户完全可能
    // "崩溃后先关掉记录省电，回头再上传现场"；旧实现连现场一起删，证据直接没了。
    // 磁盘上的 latest.json 原样保留（里面是关开关前的会话轨迹）；删除走「清空」按钮。
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    crumbs = [];
    jsErrors = [];
  }
}

/**
 * AppState 桥（v1.35.0）：由 `_layout.tsx` 的 `AppState.addEventListener("change", …)` 驱动。
 * 放在 _layout 而不是这里，是为了让本文件保持零 react-native import（踩坑 60/89）。
 */
export function setCrashCaptureAppState(state: string): void {
  appStateActive = state === "active";
}

// ---------------------------------------------------------------- 面包屑

/**
 * 记一条面包屑。**必须在任何可能闪退的操作之前调用**——它只把数据放进内存并安排一次防抖写盘，
 * 不做任何动画/渲染，不会成为新的闪退源（不要在这里 setState）。
 */
export function recordCrumb(kind: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  const t = now();
  if (kind === "scroll") {
    if (t - lastScrollCrumbAt < SCROLL_CRUMB_MIN_GAP_MS) return;
    lastScrollCrumbAt = t;
  }
  crumbs = pushCrumb(crumbs, { t, kind, data });
  dirtySinceWrite = true;
  scheduleFlush();
}

/** 当前页面（由根布局的 pathname 驱动） */
export function setCurrentScreen(pathname: string): void {
  lastScreen = pathname;
  recordCrumb("screen", { path: pathname });
  void AsyncStorage.setItem(LAST_SCREEN_KEY, pathname).catch(() => undefined);
}

function recordJsError(error: unknown, fatal: boolean): void {
  const e = error as { message?: string; stack?: string } | null | undefined;
  const info: JsErrorInfo = {
    t: now(),
    message: String(e?.message ?? error ?? "unknown error").slice(0, 2000),
    stack: String(e?.stack ?? "").slice(0, 8000),
    fatal,
  };
  jsErrors = jsErrors.concat([info]).slice(-JS_ERROR_LIMIT);
  dirtySinceWrite = true;
  scheduleFlush(0);
}

// ---------------------------------------------------------------- 安装

/**
 * 安装取证钩子（幂等）。
 *
 * ⚠️ 顺序约束：**必须在 React 渲染之前**调用 —— 目前是 `app/_layout.tsx` 的**模块顶层**
 * （与 SplashScreen.preventAutoHideAsync 同一位置）。放在组件 effect 里会晚于子组件 effect，
 * 那时新会话已经写过屏幕面包屑、甚至已经覆盖了上一份快照。
 */
export function installCrashCapture(): void {
  if (installed) return;
  installed = true;

  // 0) 启动引导：建目录 → **先另存崩溃现场** → 读开关 → 起心跳
  ready = (async () => {
    await ensureDir();
    await preservePreviousSnapshot();
    await loadCaptureEnabled();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (!enabled || !appStateActive) return;
      // 没有新内容只续心跳文件（v1.35.0：不再每次重写整个快照 —— 5s×2 文件的写盘量降到 30s×1 小文件）
      if (!dirtySinceWrite) {
        void writeHeartbeat();
        return;
      }
      void writeSnapshot();
    }, HEARTBEAT_INTERVAL_MS);
  })();

  // 1) JS 致命错误：release 下 RN 的默认 handler 会直接终止进程 → 先记我们的，再交回原 handler
  try {
    const eu = (global as unknown as { ErrorUtils?: { getGlobalHandler?: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler?: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
    if (eu?.getGlobalHandler && eu.setGlobalHandler) {
      const prev = eu.getGlobalHandler();
      eu.setGlobalHandler((error: unknown, fatal?: boolean) => {
        // 2026-10-07 二轮评审（B-3）：recordJsError 里的 String(e?.message) 遇到 getter 抛错的
        // 宿主对象会 throw —— 全局 handler 里再抛 = 顶替掉真正的 fatal、取证链反而断掉。
        // console.error 包装器一直包着，这里补齐一致性。
        try {
          recordJsError(error, !!fatal);
          flushNow();
        } catch {
          // 忽略：绝不能让取证自身抛错影响原始 fatal 的传递
        }
        try {
          prev?.(error, fatal);
        } catch {
          // 原 handler 抛错也不能影响取证链
        }
      });
    }
  } catch {
    // 忽略
  }

  // 2) console.error 也收进来：RN 把不少"非致命但很吵"的问题打在这里
  try {
    const original = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      try {
        recordJsError(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "), false);
      } catch {
        // 忽略
      }
      original(...args);
    };
  } catch {
    // 忽略
  }
}

// ---------------------------------------------------------------- 读取 / 清理

/**
 * 读取快照。
 * @param which current = 本次会话；previous = 启动时另存的**崩溃现场**（上一次会话）
 */
export async function readSnapshot(which: "current" | "previous" = "current"): Promise<CrumbSnapshot | null> {
  if (ready) await ready;
  const file = which === "previous" ? PREV_FILE : LATEST_FILE;
  const parsed = await readSnapshotFile(file);
  if (!parsed) return null;
  return { updatedAt: parsed.updatedAt, crumbs: parsed.crumbs, lastScreen: parsed.lastScreen, jsErrors: parsed.jsErrors };
}

/** 心跳时间（epoch ms）。previous = 崩溃现场那次会话的心跳 */
export async function readLastHeartbeat(which: "current" | "previous" = "current"): Promise<number | null> {
  try {
    const file = which === "previous" ? PREV_HEARTBEAT_FILE : HEARTBEAT_FILE;
    const info = await LegacyFileSystem.getInfoAsync(file);
    if (!info.exists) return null;
    const n = Number(await LegacyFileSystem.readAsStringAsync(file, { encoding: "utf8" }));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function readLastScreen(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SCREEN_KEY);
  } catch {
    return null;
  }
}

export async function clearLocalDiagnostics(): Promise<void> {
  crumbs = [];
  jsErrors = [];
  try {
    await LegacyFileSystem.deleteAsync(LATEST_FILE, { idempotent: true });
    await LegacyFileSystem.deleteAsync(PREV_FILE, { idempotent: true });
    await LegacyFileSystem.deleteAsync(HEARTBEAT_FILE, { idempotent: true });
    await LegacyFileSystem.deleteAsync(PREV_HEARTBEAT_FILE, { idempotent: true });
  } catch {
    // 忽略
  }
}

/** 上传时间戳：避免每次冷启动都提示"上次异常退出" */
export async function getLastUploadedAt(): Promise<number> {
  try {
    return Number(await AsyncStorage.getItem(LAST_UPLOAD_KEY)) || 0;
  } catch {
    return 0;
  }
}

export async function markUploaded(at: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_UPLOAD_KEY, String(at));
  } catch {
    // 忽略
  }
}

/** 本次安装的设备标识（同一台设备的多次崩溃可以串起来；卸载重装会变） */
export async function getInstallId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(INSTALL_KEY);
    if (existing) return existing;
    const id = "i" + now().toString(36) + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem(INSTALL_KEY, id);
    return id;
  } catch {
    return "unknown";
  }
}
