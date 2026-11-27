import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import {
  nextReminderOccurrences,
  reminderBlockedByQuietHours,
  type HealthReminderCandidate,
  type ReminderPrefs,
} from "@learn-workbench/shared/health-rules";
import { toDateKey } from "@learn-workbench/shared/dates";

/**
 * 健康提醒 → Android 本地通知（手写原生模块，不额外申请精确闹钟权限）。
 *
 * 只用 `setAndAllowWhileIdle` / `setExactAndAllowWhileIdle`（后者仅在系统已授权时），
 * 不申请 SCHEDULE_EXACT_ALARM、不申请 RECEIVE_BOOT_COMPLETED：
 *  - 应用每次启动 / 打开健康基线页时重新调度未来 7 天；
 *  - 设备重启后提醒会等下一次打开 App 再补，避免为了两条生活方式提醒扩权。
 */
interface HealthReminderNative {
  schedule(id: string, title: string, body: string, triggerAtMs: number): void;
  cancel(id: string): void;
  cancelAll(): void;
}

function nativeModule(): HealthReminderNative | null {
  const n = (NativeModules as unknown as { HealthReminder?: HealthReminderNative }).HealthReminder;
  return n && typeof n.schedule === "function" ? n : null;
}

export function healthReminderSupported(): boolean {
  return Platform.OS === "android" && nativeModule() !== null;
}

let askedPermission = false;

/** Android 13+ 的 POST_NOTIFICATIONS 运行时权限；其他版本直接视为可用 */
export async function requestHealthNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const version = Number(Platform.Version);
  if (!Number.isFinite(version) || version < 33) return true;
  try {
    if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) return true;
  } catch {
    // 继续走 request
  }
  if (askedPermission) return false;
  askedPermission = true;
  try {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * 按用户偏好重新调度。
 * 先 cancelAll 再 schedule，避免规则变化后旧提醒还留在系统闹钟里。
 * 返回真正排入的数量（静默时段 / 未开启 / 规则未触发都会跳过）。
 */
export function syncHealthReminders(
  candidates: readonly HealthReminderCandidate[],
  prefs: ReminderPrefs,
  now: Date = new Date(),
  days = 7
): number {
  const native = nativeModule();
  if (!native) return 0;
  try {
    native.cancelAll();
  } catch {
    // 忽略：继续尝试排新的
  }

  let count = 0;
  for (const reminder of candidates) {
    const enabled = reminder.key === "early-sleep" ? prefs.earlySleep === true : prefs.protein === true;
    if (!enabled || !reminder.active) continue;
    if (reminderBlockedByQuietHours(reminder, prefs)) continue;
    const occurrences = nextReminderOccurrences(reminder, now, days);
    for (const date of occurrences) {
      const id = `health-${reminder.key}-${toDateKey(date)}`;
      try {
        native.schedule(id, reminder.title, reminder.body, date.getTime());
        count += 1;
      } catch {
        // 单条失败不影响其他提醒
      }
    }
  }
  return count;
}

export function cancelAllHealthReminders(): void {
  const native = nativeModule();
  if (!native) return;
  try {
    native.cancelAll();
  } catch {
    // 忽略
  }
}

/** 设置页 / 健康基线页的「测试提醒」—— 5 秒后弹一条本地通知 */
export async function scheduleTestHealthReminder(): Promise<boolean> {
  const native = nativeModule();
  if (!native) return false;
  const granted = await requestHealthNotificationPermission();
  if (!granted) return false;
  try {
    native.schedule(
      "health-test",
      "健康提醒测试",
      "如果你看到这条通知，说明早睡 / 补蛋白提醒可以正常送达。",
      Date.now() + 5_000
    );
    return true;
  } catch {
    return false;
  }
}


/* ------------------------------------------------------------------ */
/* 冷启动续期：把上次的提醒计划缓存到本机，App 启动 / 回前台时重新排未来 7 天 */
/* ------------------------------------------------------------------ */

const CACHE_KEY = "lwb:health-reminder-plan:v1";
/** 前台续期节流：6 小时内只排一次，避免每次切回前台都 cancelAll + 重排 */
let lastRearmAt = 0;

type CachedReminder = Pick<HealthReminderCandidate, "key" | "title" | "body" | "hour" | "minute" | "active">;

/** 在健康基线页同步成功后调用：缓存“当前生效的提醒计划 + 偏好”，供冷启动续期 */
export async function rememberHealthReminderPlan(
  candidates: readonly HealthReminderCandidate[],
  prefs: ReminderPrefs
): Promise<void> {
  try {
    const payload = {
      prefs: {
        earlySleep: prefs.earlySleep === true,
        protein: prefs.protein === true,
        quietStart: prefs.quietStart,
        quietEnd: prefs.quietEnd,
      },
      reminders: candidates
        .filter((item) => item.active)
        .map<CachedReminder>((item) => ({
          key: item.key,
          title: item.title,
          body: item.body,
          hour: item.hour,
          minute: item.minute,
          active: true,
        })),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // 缓存失败不影响当次调度
  }
}

/**
 * 冷启动 / 回前台时按缓存续期。返回排入条数。
 * 只有用户曾经打开过健康基线页并开启过提醒，才会有缓存；否则直接 0。
 */
export async function rearmStoredHealthReminders(now: Date = new Date(), minIntervalMs = 6 * 3600_000): Promise<number> {
  if (!healthReminderSupported()) return 0;
  if (minIntervalMs > 0 && Date.now() - lastRearmAt < minIntervalMs) return 0;
  lastRearmAt = Date.now();
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(CACHE_KEY);
  } catch {
    return 0;
  }
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { prefs?: ReminderPrefs; reminders?: CachedReminder[] };
    const prefs = parsed?.prefs ?? {};
    if (!prefs.earlySleep && !prefs.protein) {
      // 用户已关掉全部提醒：清掉可能残留的系统闹钟
      cancelAllHealthReminders();
      return 0;
    }
    const list = Array.isArray(parsed?.reminders) ? parsed.reminders : [];
    const candidates: HealthReminderCandidate[] = list
      .filter((item) => item && typeof item.hour === "number" && typeof item.minute === "number")
      .map((item) => ({
        key: item.key === "protein" ? "protein" : "early-sleep",
        title: String(item.title ?? ""),
        body: String(item.body ?? ""),
        hour: Math.max(0, Math.min(23, Math.round(item.hour))),
        minute: Math.max(0, Math.min(59, Math.round(item.minute))),
        windowLabel: "",
        confidence: "early",
        evidence: "",
        active: true,
      }));
    if (candidates.length === 0) return 0;
    return syncHealthReminders(candidates, prefs, now, 7);
  } catch {
    return 0;
  }
}
