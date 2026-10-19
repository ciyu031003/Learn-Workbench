/**
 * 同步协议 v2 契约（S5-2）：push 请求 / 逐条回执 / 拉取响应。
 *
 * 约定：服务端与移动端共用这一份 schema；字段变化必须先改这里再改两端。
 *
 * 与 v1 的差异（向后兼容的增量）：
 *  1. push 响应从 `{ ok, applied, serverTime }` 增加 `receipts`（逐条回执，含 seq）；
 *  2. push 请求的 updatedAt 严格校验（必须是带时区的 ISO-8601）；非法值由服务端按条定位返回 400；
 *  3. pull 响应增加 `hasMore`/`cursor`，支持 entities 白名单与 limit 分页；
 *  4. 冲突裁决仍为 LWW（updated_at 大者胜），同 updatedAt 时以服务端单调 `seq` 大者胜。
 */
import { z } from "zod";
import {
  certificateSchema,
  checkinSchema,
  dailyTaskSchema,
  exerciseLogSchema,
  focusSessionSchema,
  habitSchema,
  logEntrySchema,
} from "./schemas";

/* ============================ 实体与基础字段 ============================ */

/**
 * 同步实体白名单（单一事实源）。
 * - 服务端：sync-service 的 APPLIERS / collectChangesSince 必须与之一一对应；
 * - 移动端：entityType 的联合类型由此推导；
 * - 白名单外的实体在 push 里按条回执 rejected（不整批 400），便于服务端版本落后时向前兼容。
 */
export const SYNC_ENTITY_TYPES = [
  "progress",
  "tasks",
  "sessions",
  "checkins",
  "logs",
  "github",
  "customTopics",
  "exerciseLogs",
  "certificates",
  "habits",
  "habitLogs",
] as const;

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

export const syncEntityTypeSchema = z.enum(SYNC_ENTITY_TYPES);

export const SYNC_OPERATIONS = ["CREATE", "UPDATE", "DELETE"] as const;

export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const syncOperationSchema = z.enum(SYNC_OPERATIONS);

/** 单批变更上限（与 push 路由的 413 阈值一致） */
export const SYNC_MAX_CHANGES = 500;

/** pull 分页：默认/上限 */
export const SYNC_PULL_DEFAULT_LIMIT = 500;
export const SYNC_PULL_MAX_LIMIT = 1000;

/**
 * updatedAt 严格校验：
 * - 必须是**带时区**的 ISO-8601（`...Z` 或 `...+08:00`）—— naive 时间在多端场景必然歧义；
 * - 必须能被 Date.parse 解析（拒绝 2026-02-31 这类日历非法值）；
 * - 不做"未来时间"拒绝：设备时钟漂移是常态，服务端在 atOf() 里统一钳制。
 */
const ISO_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

export const syncUpdatedAtSchema = z
  .string()
  .min(16)
  .max(40)
  .refine((value) => ISO_WITH_ZONE.test(value), {
    message: "updatedAt 必须是带时区的 ISO-8601 时间（如 2026-08-13T10:00:00.000Z）",
  })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "updatedAt 不是合法日期时间",
  });

/** 实体 ID：客户端稳定 ID（client_id）或自然键（topicId / checkinDate / habit|date） */
export const syncEntityIdSchema = z.string().min(1).max(200);

/** 幂等键：客户端生成；缺省时服务端仍会应用变更，但重试可能重复应用 */
export const syncChangeIdSchema = z.string().min(1).max(128);

/** 数据库 bigint 经 pg/node-postgres 默认序列化为 string；契约两端都按"数字或数字字符串"接受 */
const syncLooseIdSchema = z.union([z.number(), z.string()]);

/* ============================ 各实体 payload ============================ */

/**
 * payload = 实体的**业务字段**（不含 updatedAt：更新时间在变更顶层，避免两处不一致）。
 * 既有 entity schema 复用；只在两处放宽：
 *  - id 允许 string（bigint 序列化口径，见 S5-4）；
 *  - 服务端生成的 clientId 允许缺省/为 null（旧数据）。
 */
const progressPayloadSchema = z.object({
  done: z.boolean(),
  note: z.string().nullable(),
});

const tasksPayloadSchema = dailyTaskSchema.extend({
  id: syncLooseIdSchema.optional(),
  clientId: z.string().nullable().optional(),
});

const sessionsPayloadSchema = focusSessionSchema.extend({
  id: syncLooseIdSchema.optional(),
  clientId: z.string().nullable().optional(),
});

const checkinsPayloadSchema = checkinSchema;

const logsPayloadSchema = logEntrySchema.omit({ updatedAt: true }).extend({
  id: syncLooseIdSchema.optional(),
  clientId: z.string().nullable().optional(),
});

const githubPayloadSchema = z.object({
  id: syncLooseIdSchema.optional(),
  clientId: z.string().nullable().optional(),
  title: z.string(),
  url: z.string().nullable(),
  content: z.string().nullable(),
});

const customTopicsPayloadSchema = z.object({
  id: syncLooseIdSchema.optional(),
  clientId: z.string().nullable().optional(),
  phaseId: z.number(),
  title: z.string(),
  summary: z.string().nullable(),
  sortOrder: z.number().optional(),
});

const exerciseLogsPayloadSchema = exerciseLogSchema.extend({
  id: syncLooseIdSchema.optional(),
  clientId: z.string().nullable().optional(),
  typeLabel: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const certificatesPayloadSchema = certificateSchema.extend({
  id: syncLooseIdSchema.optional(),
  clientId: z.string().nullable().optional(),
});

const habitsPayloadSchema = habitSchema.extend({
  id: syncLooseIdSchema.optional(),
  clientId: z.string().nullable().optional(),
});

const habitLogsPayloadSchema = z.object({
  habitClientId: z.string().min(1).max(200),
  logDate: z.string().min(8).max(10),
  value: z.number(),
  note: z.string().nullable().optional(),
});

/** entityType → payload schema（push 与 pull 共用；白名单外的实体没有 schema） */
export const SYNC_PAYLOAD_SCHEMAS = {
  progress: progressPayloadSchema,
  tasks: tasksPayloadSchema,
  sessions: sessionsPayloadSchema,
  checkins: checkinsPayloadSchema,
  logs: logsPayloadSchema,
  github: githubPayloadSchema,
  customTopics: customTopicsPayloadSchema,
  exerciseLogs: exerciseLogsPayloadSchema,
  certificates: certificatesPayloadSchema,
  habits: habitsPayloadSchema,
  habitLogs: habitLogsPayloadSchema,
} as const;

export type SyncPayloadFor<T extends SyncEntityType> = z.infer<(typeof SYNC_PAYLOAD_SCHEMAS)[T]>;

/* ============================ 单条变更 ============================ */

const changeBaseShape = {
  entityId: syncEntityIdSchema,
  operation: syncOperationSchema,
  version: z.number().int().min(0).max(1_000_000).default(1),
  changeId: syncChangeIdSchema.optional(),
  updatedAt: syncUpdatedAtSchema,
};

function changeVariant<T extends SyncEntityType>(entityType: T, payload: (typeof SYNC_PAYLOAD_SCHEMAS)[T]) {
  return z.object({
    entityType: z.literal(entityType),
    payload: payload.nullable(),
    ...changeBaseShape,
  });
}

/**
 * 单条变更（discriminated by entityType）。
 * - 非 DELETE 必须带 payload；
 * - DELETE 的 payload 必须为 null（服务端只认软删除标记，忽略 payload 里的内容）。
 */
export const syncChangeSchema = z
  .discriminatedUnion("entityType", [
    changeVariant("progress", progressPayloadSchema),
    changeVariant("tasks", tasksPayloadSchema),
    changeVariant("sessions", sessionsPayloadSchema),
    changeVariant("checkins", checkinsPayloadSchema),
    changeVariant("logs", logsPayloadSchema),
    changeVariant("github", githubPayloadSchema),
    changeVariant("customTopics", customTopicsPayloadSchema),
    changeVariant("exerciseLogs", exerciseLogsPayloadSchema),
    changeVariant("certificates", certificatesPayloadSchema),
    changeVariant("habits", habitsPayloadSchema),
    changeVariant("habitLogs", habitLogsPayloadSchema),
  ])
  .refine((change) => change.operation === "DELETE" || change.payload !== null, {
    message: "非 DELETE 变更必须携带 payload",
    path: ["payload"],
  })
  .refine((change) => change.operation !== "DELETE" || change.payload === null, {
    message: "DELETE 变更的 payload 必须为 null",
    path: ["payload"],
  });

export type SyncChangeInput = z.infer<typeof syncChangeSchema>;

/* ============================ push 请求 / 响应 ============================ */

export const syncPushEnvelopeSchema = z.object({
  deviceId: z.string().max(64).optional(),
  deviceName: z.string().max(50).nullable().optional(),
  /** 先按 unknown[] 收，路由再逐条 safeParse —— 便于把错误定位到"第几条" */
  changes: z.array(z.unknown()),
});

export const syncPushSchema = z.object({
  deviceId: z.string().max(64).optional(),
  deviceName: z.string().max(50).nullable().optional(),
  changes: z.array(syncChangeSchema).max(SYNC_MAX_CHANGES),
});

export type SyncPushInput = z.infer<typeof syncPushSchema>;

/** 逐条回执结果 */
export const SYNC_RECEIPT_RESULTS = ["applied", "stale", "rejected"] as const;

export type SyncReceiptResult = (typeof SYNC_RECEIPT_RESULTS)[number];

export const syncReceiptResultSchema = z.enum(SYNC_RECEIPT_RESULTS);

/**
 * 回执 reason（机器可读）：
 * - applied / applied_lww：已写入（后者为本地更新、LWW 保留本地的分支，当前实现尚未细分）
 * - duplicate：changeId 已应用过（幂等重试）
 * - unknown_entity_type：服务端不认识该实体（客户端版本更新）
 * - invalid_entity_id：实体 ID 无法解析（如 progress 的 topicId 不是数字）
 * - apply_failed：applier 抛错（已回滚该条，不影响其它条）
 */
export const SYNC_RECEIPT_REASONS = {
  applied: "applied",
  lwwKeptLocal: "lww_kept_local",
  duplicate: "duplicate",
  unknownEntityType: "unknown_entity_type",
  invalidEntityId: "invalid_entity_id",
  applyFailed: "apply_failed",
} as const;

export const syncPushReceiptSchema = z.object({
  /** 客户端幂等键；客户端未提供时为 null */
  changeId: z.string().nullable(),
  /** 该变更在请求 changes[] 中的下标（0-based，便于客户端精确定位） */
  index: z.number().int().nonnegative(),
  result: syncReceiptResultSchema,
  reason: z.string().min(1).max(64),
  /** 服务端单调序号（sync_changes.seq）；rejected 时为 null */
  seq: z.number().int().positive().nullable(),
});

export type SyncPushReceipt = z.infer<typeof syncPushReceiptSchema>;

export const syncPushResponseSchema = z.object({
  ok: z.literal(true),
  applied: z.number().int().nonnegative(),
  receipts: z.array(syncPushReceiptSchema),
  /** 服务端时间（Asia/Shanghai，ISO-8601 带 +08:00）——客户端唯一可信游标来源 */
  serverTime: z.string().min(1),
});

export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;

/* ============================ pull 响应 ============================ */

export const syncPullResponseSchema = z.object({
  changes: z.array(syncChangeSchema),
  serverTime: z.string().min(1),
  /** 是否还有下一页（cursor 分页；无 cursor 时表示"已取完"） */
  hasMore: z.boolean().optional(),
  /** 下一页游标；hasMore=false 时为 null */
  cursor: z.string().nullable().optional(),
});

export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;

/* ============================ 纯工具（双端共用） ============================ */

/**
 * 解析 entities 白名单参数（pull 用）。
 * - 空/undefined → null（表示"全部实体"，保持 v1 行为）；
 * - 含未知实体 → 返回 { invalid: [...] }，由调用方回 400（不静默忽略，避免客户端以为拉到了却漏实体）；
 * - 去重、保持 SYNC_ENTITY_TYPES 顺序（服务端 collect 顺序稳定，游标才稳定）。
 */
export function parseSyncEntityList(
  raw: string | null | undefined
): { ok: true; entities: SyncEntityType[] | null } | { ok: false; invalid: string[] } {
  if (raw === null || raw === undefined) return { ok: true, entities: null };
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return { ok: true, entities: null };
  const known = new Set<string>(SYNC_ENTITY_TYPES);
  const invalid = tokens.filter((token) => !known.has(token));
  if (invalid.length > 0) return { ok: false, invalid };
  const wanted = new Set(tokens);
  return { ok: true, entities: SYNC_ENTITY_TYPES.filter((entity) => wanted.has(entity)) };
}
