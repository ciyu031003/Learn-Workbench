/**
 * 持久化分层核心（S5-6，纯函数、零 react-native 依赖，可单测）。
 *
 * 背景：app-store 之前用**单个** AsyncStorage key 持久化全部状态。真机上业务数据越滚越大
 * （sessions / pendingChanges 无上限），每次任意偏好变更（切主题、切后台开关）都会把整包
 * 业务数据重新序列化写盘，主线程卡顿 + 写放大。
 *
 * 分层后只写变化的那一半：
 *   - light（session/偏好）：token(置空) / username / ownerUserId / deviceId / apiUrl /
 *     themeMode / edgeSwipeEnabled / backgroundEnabled / lastSyncedAt / aiTip —— 小、写得频繁；
 *   - heavy（业务数据 + 发件箱）：progress / tasks / logs / sessions / checkins / github /
 *     customTopics / sports / habits / habitLogs / pendingChanges —— 大、只在业务变更时写。
 *
 * 同时提供 pendingChanges 的「同实体合并 + 2000 条上限」归一化（防止离线队列无限膨胀）。
 */

/** 轻量层（偏好/会话元数据）字段 */
export const LIGHT_STATE_KEYS = [
  "token",
  "username",
  "ownerUserId",
  "deviceId",
  "apiUrl",
  "themeMode",
  "edgeSwipeEnabled",
  "backgroundEnabled",
  "lastSyncedAt",
  "aiTip",
] as const;

/** 重量层（业务数据 + 待同步队列）字段 */
export const HEAVY_STATE_KEYS = [
  "progress",
  "tasks",
  "logs",
  "sessions",
  "checkins",
  "github",
  "customTopics",
  "sports",
  "habits",
  "habitLogs",
  "pendingChanges",
] as const;

const HEAVY_KEY_SET = new Set<string>(HEAVY_STATE_KEYS);

/** 单次 heavy 写盘体积告警阈值：1.5MB（UTF-8 字节） */
export const HEAVY_WRITE_BUDGET_BYTES = Math.round(1.5 * 1024 * 1024);

/** pendingChanges 离线队列上限：超出后丢弃最旧（队列首=最新） */
export const PENDING_QUEUE_LIMIT = 2000;

export interface PersistChangeLike {
  entityType: string;
  entityId: string;
  updatedAt: string;
  changeId?: string;
}

export type PersistedSlice = Record<string, unknown>;

/** 把完整持久化状态拆成轻/重两份（未知字段归入 light，保证向前兼容） */
export function splitPersistedState(state: PersistedSlice): { light: PersistedSlice; heavy: PersistedSlice } {
  const light: PersistedSlice = {};
  const heavy: PersistedSlice = {};
  for (const [key, value] of Object.entries(state)) {
    if (HEAVY_KEY_SET.has(key)) heavy[key] = value;
    else light[key] = value;
  }
  return { light, heavy };
}

/** 读取时把两份合并回一个 state（heavy 优先，理论上不会重叠） */
export function mergePersistedState(light: PersistedSlice | null, heavy: PersistedSlice | null): PersistedSlice {
  return { ...(light ?? {}), ...(heavy ?? {}) };
}

/** UTF-8 字节数（Hermes 无 TextEncoder 也能用；正确处理代理对） */
export function utf8ByteLength(input: string): number {
  let bytes = 0;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/** 序列化后的容器是否超过 heavy 写盘预算（给诊断用） */
export function isHeavyWriteOverBudget(bytes: number): boolean {
  return bytes > HEAVY_WRITE_BUDGET_BYTES;
}

/**
 * pendingChanges 归一化（S5-6）：
 *  1) 同一实体（entityType + entityId）只保留 updatedAt 最新的一条 —— 离线期间同一任务反复勾选
 *     不该产生 N 条推送；保留最新即可（服务端 LWW 语义一致）。
 *  2) 条数上限 2000，超出丢弃队列尾部（最旧）。
 *
 * 时间相同则保留队列中靠前（= 更晚入队）的那条。返回新数组，不修改入参。
 */
export function normalizePendingQueue<T extends PersistChangeLike>(
  queue: T[],
  limit: number = PENDING_QUEUE_LIMIT
): T[] {
  if (queue.length === 0) return queue;
  const keptIndex = new Map<string, number>();
  const out: T[] = [];
  for (const change of queue) {
    const key = change.entityType + "\u0000" + change.entityId;
    const existingIndex = keptIndex.get(key);
    if (existingIndex === undefined) {
      keptIndex.set(key, out.length);
      out.push(change);
      continue;
    }
    const existing = out[existingIndex];
    if (Date.parse(change.updatedAt) > Date.parse(existing.updatedAt)) out[existingIndex] = change;
  }
  return out.length > limit ? out.slice(0, limit) : out;
}

export interface PersistReport {
  /** 写入/读取发生的时刻（ISO） */
  at: string;
  /** 拆分来源：split=新双 key；legacy=从旧单 key 迁移；empty=无历史数据 */
  source: "split" | "legacy" | "empty";
  lightBytes: number;
  heavyBytes: number;
  lightChanged: boolean;
  heavyChanged: boolean;
  /** heavy 超过 1.5MB 时为 true（会同时打诊断） */
  heavyOverBudget: boolean;
  error: string | null;
}

export function buildPersistReport(input: Omit<PersistReport, "at" | "heavyOverBudget">, now: number = Date.now()): PersistReport {
  return {
    at: new Date(now).toISOString(),
    ...input,
    heavyOverBudget: isHeavyWriteOverBudget(input.heavyBytes),
  };
}

/** 恢复结果摘要（写进日志/面包屑，便于线上排查“数据怎么没了”） */
export interface RehydrateSummary {
  tasks: number;
  sessions: number;
  pending: number;
  habits: number;
  habitLogs: number;
  heavyBytes: number;
}

export function summarizeRehydratedState(state: PersistedSlice | null | undefined): RehydrateSummary {
  const count = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
  const recordCount = (v: unknown): number =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v as Record<string, unknown>).length : 0;
  const s = state ?? {};
  return {
    tasks: count(s.tasks),
    sessions: count(s.sessions),
    pending: count(s.pendingChanges),
    habits: count(s.habits),
    habitLogs: count(s.habitLogs),
    heavyBytes: utf8ByteLength(JSON.stringify(s)),
  };
}

export function describeRehydrateSummary(summary: RehydrateSummary): string {
  return `恢复完成：任务 ${summary.tasks} · 专注 ${summary.sessions} · 习惯 ${summary.habits} · 打卡 ${summary.habitLogs} · 待同步 ${summary.pending} · 数据 ${(summary.heavyBytes / 1024).toFixed(1)}KB`;
}
