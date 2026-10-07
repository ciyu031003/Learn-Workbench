/**
 * 崩溃取证的**纯逻辑层**（v1.32.0）。
 *
 * 背景：招花（jobs）滑动仍然闪退，且前三次"去掉 item 动画"的修复都没根治。
 * 崩溃是**进程级死亡**（native SIGSEGV / Java 未捕获异常），崩溃那一瞬间 JS 已经没了 ——
 * 所以取证只有两条路：
 *   1. **崩溃前持续落盘**（面包屑 ring buffer，见 crash-capture.ts）；
 *   2. **下次启动时向系统要**（Android 11+ 的 ActivityManager 历史退出记录，见原生 CrashLogModule.kt）。
 *
 * 本文件只放**零依赖纯函数**（不 import react-native / expo-* / 原生模块）：
 * 踩坑 48/89 —— 移动端 vitest 只要间接 import 到 react-native 就会整份 suite 以
 * "Flow is not supported" 失败且不报测试名。RN 侧的胶水代码在 crash-capture.ts。
 */

/** 面包屑上限：够看"崩溃前最后几秒"，又不会把上报体积撑爆 */
export const CRUMB_LIMIT = 120;
/** 单条 exit trace / logcat 的字符上限（上游还有字节上限，这里先截字符） */
export const TRACE_MAX_CHARS = 20000;
/**
 * logcat 上限。⚠️ v1.32.0 首次上报踩到的坑：原来对 logcat 用的是**取头部**的 clampText，
 * 而 native 侧 `logcat -d` 已经取的是**尾部**（崩溃现场在最后）→ 头 60KB 里全是崩溃前 1 秒的
 * 噪音，真正致命的 FATAL EXCEPTION 反而被截掉。**logcat 必须取尾**（clampTail）。
 */
export const LOGCAT_MAX_CHARS = 120000;
/** 上报正文上限（服务端也是这个口径，两边一致避免"客户端能传、服务端 413"） */
export const REPORT_MAX_BYTES = 512 * 1024;

export interface Crumb {
  /** epoch ms */
  t: number;
  /** 面包屑类型：screen / scroll / action / fetch / lifecycle */
  kind: string;
  data?: Record<string, unknown>;
}

export interface ExitInfo {
  /** 可读原因名（见 exitReasonName） */
  reason: string;
  /** ApplicationExitInfo.getReason() 原始值 */
  reasonCode: number;
  /** epoch ms */
  timestamp: number;
  description: string;
  /** native / java 崩溃栈或 ANR traces（可能为空串） */
  trace: string;
}

export interface JsErrorInfo {
  t: number;
  message: string;
  stack: string;
  fatal: boolean;
}

export interface DiagnosticInput {
  generatedAt: number;
  /** 客户端安装一次生成一个，用于把同一台设备的多次崩溃串起来 */
  installId: string;
  app: { version: string; build: string; platform: string; osVersion: string; model: string; isDevice: boolean };
  /** 设置里的取证开关状态 */
  captureEnabled: boolean;
  /** 上次进程退出（原生通道；拿不到为 null） */
  lastExit: ExitInfo | null;
  /** 心跳文件里的最后时间（判断"上次没干干净净退出"） */
  lastHeartbeatAt: number | null;
  /** 崩溃前最后停留的页面 */
  lastScreen: string | null;
  crumbs: Crumb[];
  /** 这批面包屑来自哪次会话：crash = 上一份快照（崩溃现场），current = 当前会话 */
  crumbSource?: "crash" | "current";
  jsErrors: JsErrorInfo[];
  logcat: string;
  /** 用户主动填的备注（"下滑岗位时闪退"这类现场信息） */
  note?: string;
}

// ---------------------------------------------------------------- 脱敏

/**
 * 日志里绝不能带走的敏感串。**宁可多抹一点**：
 * 诊断包会落到服务器磁盘并被我（或后续排障的人）读取，泄漏一次 token 就等于泄漏账号。
 */
/**
 * 脱敏规则：[正则, 替换]。顺序有意义（先键值对，再长随机串）。
 * ⚠️ **不要用 lookbehind**（(?<=) / (?<!)，Hermes 对它的支持不稳，模块加载期就可能抛 SyntaxError
 * → 直接变成一个新的闪退）。需要边界就用捕获组。
 */
const REDACT_RULES: [RegExp, string][] = [
  // Authorization / Bearer 这类键值对
  [/(bearer)\s+[A-Za-z0-9._~+/-]{8,}=*/gi, "$1 <redacted>"],
  [/((?:authorization|cookie|set-cookie|x-cron-secret|token|secret|password|passwd|pwd|apikey|api_key)\s*[:=]\s*)[^\s,;"']+/gi, "$1<redacted>"],
  // 邮箱
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>"],
  // 中国大陆手机号（用捕获组表达边界，避免 lookaround）
  [/(^|[^0-9])1[3-9][0-9]{9}([^0-9]|$)/g, "$1<phone>$2"],
  // 长随机串（会话 token / JWT / 签名）：长度 >= 32 的连续 base64url-ish 串
  [/[A-Za-z0-9_-]{32,}/g, "<redacted-token>"],
];

/** 逐条套用脱敏规则（顺序有意义：先键值对，再长随机串） */
export function redactSecrets(input: string): string {
  let out = String(input ?? "");
  for (const [re, to] of REDACT_RULES) out = out.replace(re, to);
  return out;
}

// ---------------------------------------------------------------- 面包屑

/** 追加一条面包屑并裁剪到上限（保留**最新**的 limit 条；崩溃现场永远在尾部） */
export function pushCrumb(list: Crumb[], crumb: Crumb, limit: number = CRUMB_LIMIT): Crumb[] {
  const next = list.concat([crumb]);
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** 截断文本并标注被截断（避免"看起来完整"的误导）。**保留头部**，适合错误信息/栈。 */
export function clampText(text: string, max: number): string {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n…（已截断，原始 " + s.length + " 字符）";
}

/**
 * 截断文本**保留尾部**：logcat 用这个 —— 崩溃/致命异常永远在缓冲区末尾
 * （native 侧 `logcat -d -t N` 也是取尾部，两边口径要一致）。
 */
export function clampTail(text: string, max: number): string {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  return "…（前部已截断，原始 " + s.length + " 字符）\n" + s.slice(s.length - max);
}

// ---------------------------------------------------------------- 退出原因

/** ApplicationExitInfo.REASON_* → 可读名（Android 11+，值为系统常量，写死避免引原生包） */
const REASON_NAMES: Record<number, string> = {
  0: "UNKNOWN",
  1: "EXIT_SELF",
  2: "SIGNALED",
  3: "LOW_MEMORY",
  4: "CRASH",
  5: "CRASH_NATIVE",
  6: "ANR",
  7: "INITIALIZATION_FAILURE",
  8: "PERMISSION_CHANGE",
  9: "EXCESSIVE_RESOURCE_USAGE",
  10: "USER_REQUESTED",
  11: "USER_STOPPED",
  12: "DEPENDENCY_DIED",
  13: "OTHER",
  14: "FREEZER",
  15: "PACKAGE_STATE_CHANGE",
  16: "PACKAGE_UPDATED",
};

export function exitReasonName(code: number): string {
  return REASON_NAMES[code] ?? "REASON_" + code;
}

/**
 * 这个退出原因是否值得在下次启动时提示"上传诊断包"。
 * 只认真正的异常：SIGNALED(2) / CRASH(4) / CRASH_NATIVE(5) / ANR(6)。
 * 用户主动杀进程（10/11）、系统回收（3/12/14）、打包更新（16）都不提示，避免变成骚扰。
 */
export function isCrashExit(reasonCode: number | null | undefined): boolean {
  if (reasonCode === null || reasonCode === undefined) return false;
  return reasonCode === 2 || reasonCode === 4 || reasonCode === 5 || reasonCode === 6;
}

/**
 * 心跳超过这个间隔就认为"上次是被杀掉的"（正常冷启动间隔通常远小于它）。
 * 只作辅助判据：Android 11+ 以原生退出记录为准。
 */
export const HEARTBEAT_STALE_MS = 90 * 1000;

export function isLikelyUnclean(lastHeartbeatAt: number | null, now: number): boolean {
  if (!lastHeartbeatAt) return false;
  return now - lastHeartbeatAt > HEARTBEAT_STALE_MS;
}

// ---------------------------------------------------------------- 组装

/** 上报文件名：时间可排序 + 随机后缀避免同秒覆盖 */
export function reportFileName(now: number, rand: string): string {
  const d = new Date(now);
  const p = (n: number) => (n < 10 ? "0" + n : String(n));
  const stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  return "crash-" + stamp + "-" + String(rand).slice(0, 8) + ".json";
}

function fmtTime(ms: number | null): string {
  if (!ms) return "(未知)";
  const d = new Date(ms);
  const p = (n: number) => (n < 10 ? "0" + n : String(n));
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

/** 把面包屑渲染成逐行文本（人读优先） */
export function formatCrumbs(crumbs: Crumb[]): string {
  return crumbs
    .map((c) => {
      const data = c.data && Object.keys(c.data).length ? " " + JSON.stringify(c.data) : "";
      return fmtTime(c.t) + "  [" + c.kind + "]" + data;
    })
    .join("\n");
}

/**
 * 生成人读报告正文。顺序 = 排障时的实际使用顺序：
 * 先看退出原因（判定是不是 native 崩）→ 再看栈 → 再看崩溃前的操作轨迹。
 */
export function buildReportText(input: DiagnosticInput): string {
  const info = input.lastExit;
  const lines: string[] = [];
  lines.push("=== Learn-Workbench 诊断包 ===");
  lines.push("生成时间: " + fmtTime(input.generatedAt));
  lines.push("应用版本: " + input.app.version + " (build " + input.app.build + ")");
  lines.push("平台: " + input.app.platform + " " + input.app.osVersion + " / " + input.app.model + (input.app.isDevice ? "" : " (非真机)"));
  lines.push("安装标识: " + input.installId);
  lines.push("取证开关: " + (input.captureEnabled ? "开" : "关"));
  lines.push("最后心跳: " + fmtTime(input.lastHeartbeatAt) + (isLikelyUnclean(input.lastHeartbeatAt, input.generatedAt) ? "  ← 超过 " + HEARTBEAT_STALE_MS / 1000 + "s，疑似非正常退出" : ""));
  lines.push("最后页面: " + (input.lastScreen ?? "(未知)") + (input.crumbSource === "crash" ? "（来自崩溃前的上一份快照）" : ""));
  if (info && !info.trace) {
    // REASON_CRASH(4) 在不少 ROM 上拿不到 trace（ApplicationExitInfo 只对 native/ANR 稳定给栈），
    // 这种情况**唯一的栈来源就是下面的 logcat**，所以 logcat 必须取尾部（见 LOGCAT_MAX_CHARS）。
    lines.push("注意: 原生未提供 trace（Java 崩溃常见），请以 logcat 尾部为准");
  }
  if (input.note && input.note.trim()) lines.push("用户备注: " + input.note.trim());
  lines.push("");
  lines.push("--- 上次进程退出（Android ApplicationExitInfo）---");
  if (info) {
    lines.push("原因: " + info.reason + " (" + info.reasonCode + ")");
    lines.push("时间: " + fmtTime(info.timestamp));
    lines.push("描述: " + (info.description || "(无)"));
  } else {
    lines.push("(无记录：Android < 11，或原生模块不可用)");
  }
  lines.push("");
  lines.push("--- 崩溃栈（native / java / ANR traces）---");
  lines.push(info && info.trace ? clampText(info.trace, TRACE_MAX_CHARS) : "(无)");
  lines.push("");
  lines.push("--- JS 全局错误（最后 " + input.jsErrors.length + " 条）---");
  if (input.jsErrors.length === 0) lines.push("(无)");
  for (const e of input.jsErrors) {
    lines.push(fmtTime(e.t) + (e.fatal ? " [fatal]" : " [warn]") + " " + e.message);
    if (e.stack) lines.push(e.stack);
  }
  lines.push("");
  lines.push("--- logcat 兜底（应用自身可见部分，取尾部）---");
  lines.push(input.logcat ? clampTail(input.logcat, LOGCAT_MAX_CHARS) : "(无)");
  lines.push("");
  lines.push("--- 面包屑（崩溃前最后 " + input.crumbs.length + " 条）---");
  lines.push(formatCrumbs(input.crumbs));
  lines.push("");
  return redactSecrets(lines.join("\n"));
}

/**
 * 崩溃现场该用哪一份面包屑。
 *
 * ⚠️ v1.32.0 首次上报踩到的第二个坑：冷启动后新会话立刻开始记录并**覆盖** latest.json，
 * 用户点「上传」时看到的面包屑只有「/ → /today」两条（新会话），崩溃前那次会话的轨迹全丢了。
 * 现在启动时会把上一份快照另存为 previous.json，这里做选择：
 *  - 有原生崩溃记录，且上一份快照的时间**早于**崩溃时刻 → 用**上一份**（那才是崩溃现场）；
 *  - 其余情况用当前快照。
 */
export function pickCrashSnapshot(
  current: CrumbSnapshot | null,
  previous: CrumbSnapshot | null,
  lastExit: { timestamp: number } | null
): { crumbs: Crumb[]; lastScreen: string | null; source: "crash" | "current" } {
  if (previous && lastExit && previous.updatedAt <= lastExit.timestamp + 5000) {
    return { crumbs: previous.crumbs, lastScreen: previous.lastScreen, source: "crash" };
  }
  if (current) return { crumbs: current.crumbs, lastScreen: current.lastScreen, source: "current" };
  if (previous) return { crumbs: previous.crumbs, lastScreen: previous.lastScreen, source: "crash" };
  return { crumbs: [], lastScreen: null, source: "current" };
}

/** 落盘快照的形状（crash-capture.ts 写、crash-report.ts 选，纯数据避免循环依赖） */
export interface CrumbSnapshot {
  updatedAt: number;
  crumbs: Crumb[];
  lastScreen: string | null;
  jsErrors?: JsErrorInfo[];
}

/** 上报 JSON（服务端按原样落盘，人读文本放在 report 字段里） */
export function buildReportJson(input: DiagnosticInput): Record<string, unknown> {
  return {
    schema: 1,
    kind: "crash",
    generatedAt: input.generatedAt,
    installId: input.installId,
    app: input.app,
    captureEnabled: input.captureEnabled,
    lastExit: input.lastExit,
    lastHeartbeatAt: input.lastHeartbeatAt,
    lastScreen: input.lastScreen,
    crumbSource: input.crumbSource ?? "current",
    note: input.note ?? "",
    jsErrors: input.jsErrors,
    logcat: redactSecrets(clampTail(input.logcat, LOGCAT_MAX_CHARS)),
    crumbs: input.crumbs,
    report: buildReportText(input),
  };
}
