/**
 * 睡眠记录（v2.0.1 真机反馈修复）：系统健康数据读取 + 手动兜底 + 本机存档。
 *
 * 背景：健康页的睡眠格长期恒为「—」，行动卡把用户丢去「领域追踪」；
 * 本次把「睡眠记录」接成一条独立的事实链：
 *   ① 自动读取 Android Health Connect 的 SleepSessionRecord（最近一晚窗口）
 *   ② 失败/未授权/本机不支持时降级为手动输入（任何设备都能记）
 *   ③ 结果存本机 AsyncStorage（键 `lwb.sleep.v1`，含日期与小时数），指标格直接读它
 *
 * 设计约束（与看板「踩坑点」一致）：
 * - **不抛异常**：原生模块缺失、未授权、超时、脏数据全部收敛成 {@link SleepHealthResult}；
 *   调用方只需要看 `status` 决定文案，不需要 try/catch。
 * - **动态 import**：`react-native-health-connect` 是 Android 原生模块（TurboModule 在
 *   import 期就会 getEnforcing），放在文件顶层会让 iOS/Web/单测直接炸；因此只在
 *   「运行时确认是 Android + 真正要读」时才 import，且整体包在 try/catch 里。
 * - **纯函数可单测**：聚合/窗口过滤/格式化/解析都在本文件，且不 import react-native，
 *   单测（src/lib/sleep.test.ts）只 mock AsyncStorage 即可跑。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toDateKey } from "@learn-workbench/shared/dates";

/** 本机睡眠存档键（单条：最近一晚；v2.0.1 新增） */
export const SLEEP_STORAGE_KEY = "lwb.sleep.v1";

/** 「昨晚」窗口：昨天 18:00 → 今天 12:00（本地时区） */
export const SLEEP_WINDOW_START_HOUR = 18;
export const SLEEP_WINDOW_END_HOUR = 12;

/** 单段/单日睡眠的物理上限（超过视为脏数据，丢弃而不是把指标撑爆） */
export const MAX_SLEEP_HOURS = 24;

/** Health Connect 睡眠读取权限（AndroidManifest 已声明，见 scripts/apply-android-native.mjs） */
export const SLEEP_READ_PERMISSION = "android.permission.health.READ_SLEEP";

/** 一次读取最多翻几页（Health Connect 默认每页 1000 条；睡眠一晚最多几条，4 页足够） */
const SLEEP_MAX_PAGES = 4;
const SLEEP_PAGE_SIZE = 100;
/** 单次原生调用超时：Health Connect 服务在部分机型上会长时间不回调 */
const SLEEP_TIMEOUT_MS = 6000;

/** 睡眠会话（只保留聚合需要的两个时间点；Health Connect 返回的原始记录更宽） */
export interface SleepSession {
  startTime: string;
  endTime: string;
}

/** 本机保存的「一晚睡眠」 */
export interface SleepEntry {
  /** 起床日（本地 YYYY-MM-DD）：昨晚的睡眠记在起床那天 */
  date: string;
  /** 睡眠小时数（保留 1 位小数，0 < hours ≤ 24） */
  hours: number;
  /** 数据来源：系统健康数据 / 手动填写 */
  source: "health" | "manual";
  /** 写入时间（ISO），仅用于留档 */
  updatedAt: string;
}

/** 读取结果：失败也有明确原因，UI 据此给不同引导文案（不弹错误框） */
export type SleepHealthStatus = "ok" | "unsupported" | "unavailable" | "denied" | "no-data" | "error";

export interface SleepHealthResult {
  ok: boolean;
  status: SleepHealthStatus;
  /** 成功时为「昨晚窗口内」的小时数（1 位小数） */
  hours: number | null;
  /** 参与聚合的有效会话段数 */
  sessions: number;
}

const HOUR_MS = 60 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * 纯函数（可单测）
 * ------------------------------------------------------------------ */

/** 小时数规整：非有限值归 0，夹到 [0, 24]，保留 1 位小数 */
export function roundSleepHours(hours: number): number {
  if (!Number.isFinite(hours)) return 0;
  const clamped = Math.min(MAX_SLEEP_HOURS, Math.max(0, hours));
  return Math.round(clamped * 10) / 10;
}

/**
 * 单段会话的时长（小时）。脏数据返回 null：
 * - 时间串解析不出来（NaN）
 * - 结束 ≤ 开始（设备时钟错乱 / 记录未闭合）
 * - 超过 24 小时（明显是脏记录，不能把一天撑成 30 小时）
 */
function sessionHours(session: SleepSession | null | undefined): number | null {
  if (!session) return null;
  const start = Date.parse(session.startTime);
  const end = Date.parse(session.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const hours = (end - start) / HOUR_MS;
  if (!(hours > 0) || hours > MAX_SLEEP_HOURS) return null;
  return hours;
}

/** 把多段睡眠会话聚合为小时数（空/脏数据安全，总量封顶 24h） */
export function aggregateSleepHours(sessions: readonly SleepSession[] | null | undefined): number {
  if (!Array.isArray(sessions)) return 0;
  let total = 0;
  for (const session of sessions) {
    const hours = sessionHours(session);
    if (hours !== null) total += hours;
  }
  return roundSleepHours(total);
}

/** 「昨晚」窗口：昨天 18:00 → 今天 12:00（本地时区；跨天由 Date 运算天然处理） */
export function lastNightWindow(now: Date = new Date()): { start: Date; end: Date } {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    start: new Date(todayMidnight.getTime() - (24 - SLEEP_WINDOW_START_HOUR) * HOUR_MS),
    end: new Date(todayMidnight.getTime() + SLEEP_WINDOW_END_HOUR * HOUR_MS),
  };
}

/**
 * 只统计「落在昨晚窗口内」的那部分睡眠（按重叠时长裁剪）。
 *
 * 为什么不直接按「整段时长」求和：Health Connect 里一段会话可能横跨窗口边界
 * （如 17:00→23:00、或 09:00→13:00），整段计入会把白天的补觉算进昨晚。
 * 裁剪后每段只贡献窗口内的部分，跨天（23:00→07:00）依旧是一整段、不重复计数。
 */
export function sleepHoursInWindow(
  sessions: readonly SleepSession[] | null | undefined,
  window: { start: Date; end: Date }
): number {
  if (!Array.isArray(sessions)) return 0;
  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) return 0;
  let total = 0;
  for (const session of sessions) {
    if (sessionHours(session) === null) continue;
    const start = Date.parse(session.startTime);
    const end = Date.parse(session.endTime);
    const overlapStart = Math.max(start, windowStart);
    const overlapEnd = Math.min(end, windowEnd);
    if (overlapEnd <= overlapStart) continue;
    total += (overlapEnd - overlapStart) / HOUR_MS;
  }
  return roundSleepHours(total);
}

/** 窗口内有效会话段数（UI 上用于「读到 N 段」的说明，也用于判断 no-data） */
export function countSessionsInWindow(
  sessions: readonly SleepSession[] | null | undefined,
  window: { start: Date; end: Date }
): number {
  if (!Array.isArray(sessions)) return 0;
  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();
  let count = 0;
  for (const session of sessions) {
    if (sessionHours(session) === null) continue;
    const start = Date.parse(session.startTime);
    const end = Date.parse(session.endTime);
    if (Math.min(end, windowEnd) > Math.max(start, windowStart)) count += 1;
  }
  return count;
}

/** 指标格/正文用的数值文案：null → 「—」，否则 1 位小数（7.5 / 8） */
export function formatSleepHoursValue(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return "—";
  const rounded = roundSleepHours(hours);
  if (rounded <= 0) return "0";
  return String(rounded);
}

/** 「昨晚 X 小时」里的 X 小时文案：null → 「—」 */
export function formatSleepHours(hours: number | null | undefined): string {
  const value = formatSleepHoursValue(hours);
  return value === "—" ? value : `${value} 小时`;
}

/**
 * 手动输入解析：支持 `7.5`、`7,5`、`7:30`（七小时半）、`7小时`；
 * 非法/超范围返回 null（调用方给一句提示，不弹窗）。
 */
export function parseSleepHoursInput(input: string | null | undefined): number | null {
  const text = String(input ?? "")
    .trim()
    .replace(/[，,]/g, ".")
    .replace(/\s+/g, "");
  if (!text) return null;

  const clock = /^(\d{1,2})[:：](\d{1,2})$/.exec(text);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes >= 60) return null;
    const total = hours + minutes / 60;
    if (!(total > 0) || total > MAX_SLEEP_HOURS) return null;
    return roundSleepHours(total);
  }

  const numeric = text.replace(/(小时|个小时|hours?|hrs?|h)$/i, "");
  if (!numeric || !/^\d+(\.\d+)?$/.test(numeric)) return null;
  const hours = Number(numeric);
  if (!Number.isFinite(hours) || !(hours > 0) || hours > MAX_SLEEP_HOURS) return null;
  return roundSleepHours(hours);
}

/**
 * 本机睡眠值是否「还算昨晚的」。
 *
 * 起床日记在 date 上（昨晚睡 → 今天醒 → date=今天）。跨过一天后（date=前天）不再显示，
 * 指标格回到「—」，避免几天后还挂着旧数字。
 */
export function isFreshSleepEntry(
  entry: SleepEntry | null | undefined,
  todayKey: string,
  yesterdayKey: string
): boolean {
  if (!entry) return false;
  return entry.date === todayKey || entry.date === yesterdayKey;
}

/** 把 AsyncStorage 里的未知 JSON 收敛成合法条目（坏数据直接当没有） */
export function normalizeSleepEntry(raw: unknown): SleepEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<SleepEntry>;
  const date = typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : null;
  const hours = typeof value.hours === "number" && Number.isFinite(value.hours) ? value.hours : null;
  if (!date || hours === null) return null;
  const rounded = roundSleepHours(hours);
  if (rounded <= 0) return null;
  return {
    date,
    hours: rounded,
    source: value.source === "health" ? "health" : "manual",
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : new Date().toISOString(),
  };
}

/** 用当前时间算出「这一晚」的日期键（起床日 = 今天） */
export function sleepEntryDateKey(now: Date = new Date()): string {
  return toDateKey(now);
}

/* ------------------------------------------------------------------ *
 * 本机存档（AsyncStorage）
 * ------------------------------------------------------------------ */

/** 读本机睡眠存档；没有/坏了都返回 null（不抛） */
export async function loadSleepEntry(): Promise<SleepEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(SLEEP_STORAGE_KEY);
    if (!raw) return null;
    return normalizeSleepEntry(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 写本机睡眠存档；失败返回 null（调用方给「保存失败」文案，不弹窗） */
export async function saveSleepEntry(
  entry: Pick<SleepEntry, "date" | "hours" | "source"> & { updatedAt?: string }
): Promise<SleepEntry | null> {
  const normalized = normalizeSleepEntry({
    ...entry,
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  });
  if (!normalized) return null;
  try {
    await AsyncStorage.setItem(SLEEP_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Health Connect（Android）
 * ------------------------------------------------------------------ */

type HealthConnectModule = typeof import("react-native-health-connect");

/** 给原生调用加超时：Health Connect 服务阻塞时不能让 Sheet 一直转圈 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("sleep-timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

function failure(status: SleepHealthStatus): SleepHealthResult {
  return { ok: false, status, hours: null, sessions: 0 };
}

/** 分页读完窗口内的睡眠会话（任何一条脏记录都跳过，不让整体失败） */
async function readSleepSessions(
  healthConnect: HealthConnectModule,
  startTime: string,
  endTime: string,
  timeoutMs: number
): Promise<SleepSession[]> {
  const sessions: SleepSession[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < SLEEP_MAX_PAGES; page += 1) {
    const result = await withTimeout(
      healthConnect.readRecords("SleepSession", {
        timeRangeFilter: { operator: "between", startTime, endTime },
        pageSize: SLEEP_PAGE_SIZE,
        ascendingOrder: true,
        ...(pageToken ? { pageToken } : {}),
      }),
      timeoutMs
    );
    for (const record of result?.records ?? []) {
      if (record && typeof record.startTime === "string" && typeof record.endTime === "string") {
        sessions.push({ startTime: record.startTime, endTime: record.endTime });
      }
    }
    pageToken = typeof result?.pageToken === "string" && result.pageToken ? result.pageToken : undefined;
    if (!pageToken) break;
  }
  return sessions;
}

/**
 * 读取「昨晚」的系统睡眠时长（Android Health Connect）。
 *
 * 永不抛异常，失败原因收敛为：
 * - `unsupported`：非 Android（iOS/Web 没有 Health Connect）
 * - `unavailable`：本机没有 Health Connect（Android 13- 未安装 / 系统不支持 / 初始化失败）
 * - `denied`：没有 READ_SLEEP 权限（`requestPermission: true` 时才会弹系统授权框）
 * - `no-data`：有权但窗口内没有睡眠记录
 * - `error`：原生模块加载失败、超时、读取报错
 */
export async function readSleepFromHealth(
  options: {
    now?: Date;
    timeoutMs?: number;
    /** 是否在未授权时主动申请 READ_SLEEP（自动读取用 false，用户点「去授权」时用 true） */
    requestPermission?: boolean;
  } = {}
): Promise<SleepHealthResult> {
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? SLEEP_TIMEOUT_MS;
  const window = lastNightWindow(now);

  let healthConnect: HealthConnectModule;
  try {
    const { Platform } = await import("react-native");
    if (Platform.OS !== "android") return failure("unsupported");
    healthConnect = await import("react-native-health-connect");
  } catch {
    // 原生模块没进包（例如还没重新构建 APK）/ 非 Android 运行时
    return failure("unsupported");
  }

  try {
    const status = await withTimeout(healthConnect.getSdkStatus(), timeoutMs);
    const available = healthConnect.SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3;
    if (status !== available) return failure("unavailable");

    const initialized = await withTimeout(healthConnect.initialize(), timeoutMs);
    if (!initialized) return failure("unavailable");

    const hasPermission = async () => {
      const granted = await withTimeout(healthConnect.getGrantedPermissions(), timeoutMs);
      return (granted ?? []).some(
        (permission) => permission?.accessType === "read" && permission?.recordType === "SleepSession"
      );
    };

    let granted = await hasPermission();
    if (!granted) {
      if (!options.requestPermission) return failure("denied");
      await withTimeout(
        healthConnect.requestPermission([{ accessType: "read", recordType: "SleepSession" }]),
        // 系统授权弹窗由用户操作，不能按读取超时掐断
        Math.max(timeoutMs, 120000)
      );
      granted = await hasPermission();
      if (!granted) return failure("denied");
    }

    const rangeStart = window.start;
    const rangeEnd = now.getTime() < window.end.getTime() ? now : window.end;
    if (rangeEnd.getTime() <= rangeStart.getTime()) return failure("no-data");

    const sessions = await readSleepSessions(
      healthConnect,
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
      timeoutMs
    );
    const count = countSessionsInWindow(sessions, window);
    const hours = sleepHoursInWindow(sessions, window);
    if (count === 0 || hours <= 0) return failure("no-data");
    return { ok: true, status: "ok", hours, sessions: count };
  } catch {
    return failure("error");
  }
}

/** 打开系统健康数据设置（Health Connect）。打不开返回 false，调用方给文案即可。 */
export async function openSleepSettings(): Promise<boolean> {
  try {
    const { Platform } = await import("react-native");
    if (Platform.OS !== "android") return false;
    const healthConnect: HealthConnectModule = await import("react-native-health-connect");
    healthConnect.openHealthConnectSettings();
    return true;
  } catch {
    return false;
  }
}

/** 各失败状态给用户看的一句话（统一口径，Sheet 与行动卡共用） */
export const SLEEP_STATUS_HINT: Record<SleepHealthStatus, string> = {
  ok: "已从系统健康数据读取昨晚睡眠",
  unsupported: "本机未提供健康数据，可手动记录",
  unavailable: "本机未提供健康数据，可手动记录",
  denied: "还没有睡眠读取权限，可手动记录或去授权",
  "no-data": "系统里还没有昨晚的睡眠记录，可手动记录",
  error: "读取系统睡眠失败，可手动记录",
};
