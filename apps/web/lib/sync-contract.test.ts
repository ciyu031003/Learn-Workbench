import { describe, expect, it } from "vitest";
import {
  SYNC_ENTITY_TYPES,
  SYNC_MAX_CHANGES,
  parseSyncEntityList,
  syncChangeSchema,
  syncPullResponseSchema,
  syncPushResponseSchema,
  syncPushSchema,
  syncUpdatedAtSchema,
} from "@learn-workbench/shared/sync";

const AT = "2026-08-13T10:00:00.000Z";
const SHANGHAI = "2026-08-13T18:00:00.000+08:00";

function change(entityType: string, payload: unknown, extra: Record<string, unknown> = {}) {
  return {
    entityType,
    entityId: "id-1",
    operation: "UPDATE",
    version: 1,
    payload,
    updatedAt: AT,
    ...extra,
  };
}

/** 移动端实际会发出的 payload（apps/mobile/src/store/app-store.ts 的 change 构造） */
const MOBILE_PAYLOADS: Record<string, unknown> = {
  progress: { topicId: 7, done: true, note: null, updatedAt: AT },
  tasks: {
    id: 3, clientId: "c-3", taskDate: "2026-08-13", title: "学 HCI", phaseId: null, topicId: null,
    taskType: "study", careerKey: "ict", done: false, focusMinutes: 25, sortOrder: 1, updatedAt: AT,
  },
  sessions: {
    id: 4, clientId: "c-4", taskId: null, startedAt: AT, endedAt: AT, durationSeconds: 1500, tag: "学习",
  },
  checkins: { checkinDate: "2026-08-13", note: null },
  logs: { id: 5, clientId: "c-5", kind: "review", title: "周复盘", content: "正文", createdAt: AT, updatedAt: AT },
  github: { id: 6, clientId: "c-6", title: "GH", url: "https://github.com/x", content: "说明" },
  customTopics: { id: 7, clientId: "c-7", phaseId: 1, title: "自定义", summary: null },
  exerciseLogs: {
    clientId: "c-8", type: "BALL", typeLabel: "篮球", durationSeconds: 1800, source: "MANUAL", startedAt: AT,
  },
  certificates: {
    id: 21, clientId: "c-21", name: "CISP", issuer: "中国信息安全测评中心", status: "achieved",
    targetDate: "2026-01-01", earnedDate: "2026-02-01", expiryDate: "2029-02-01",
    imageUrl: null, sortOrder: 0, note: null,
  },
  habits: {
    id: 31, clientId: "c-31", name: "饮水", icon: null, isBoolean: false, targetValue: 8, unit: "杯",
    schedule: [0, 1, 2], color: "#2fb3a6", sortOrder: 0,
  },
  habitLogs: { habitClientId: "c-31", logDate: "2026-09-14", value: 8, note: null },
};

/** 服务端 pull 实际返回的 payload（collectChangesSince）——id 为 bigint→string */
const PULL_PAYLOADS: Record<string, unknown> = {
  progress: { done: true, note: null },
  tasks: {
    id: "3", clientId: "c-3", taskDate: "2026-08-13", title: "学 HCI", phaseId: null, topicId: null,
    taskType: "study", careerKey: "ict", done: false, focusMinutes: 25, sortOrder: 1,
  },
  sessions: { id: "4", clientId: "c-4", taskId: null, startedAt: AT, endedAt: AT, durationSeconds: 1500, tag: null },
  checkins: { checkinDate: "2026-08-13", note: "n" },
  logs: { id: "5", clientId: "c-5", kind: "review", careerKey: "ict", title: "周复盘", content: "正文", createdAt: AT },
  github: { id: "6", clientId: "c-6", title: "GH", url: "u", content: "c" },
  customTopics: { id: "7", clientId: "c-7", phaseId: 1, title: "自定义", summary: null, sortOrder: 0 },
  exerciseLogs: {
    id: "8", clientId: "c-8", type: "BALL", typeLabel: "篮球", durationSeconds: 1800,
    source: "MANUAL", note: null, startedAt: AT,
  },
  certificates: {
    id: "21", clientId: "c-21", name: "CISP", issuer: null, status: "achieved",
    targetDate: "2026-01-01", earnedDate: null, expiryDate: "2029-02-01",
    imageUrl: null, sortOrder: 0, note: null,
  },
  habits: {
    id: "31", clientId: "c-31", name: "饮水", icon: null, isBoolean: false, targetValue: 8, unit: "杯",
    schedule: [0, 1, 2], color: "#2fb3a6", sortOrder: 0,
  },
  habitLogs: { habitClientId: "c-31", logDate: "2026-09-14", value: 8, note: null },
};

describe("syncUpdatedAtSchema（严格 ISO-8601）", () => {
  it("接受带时区的 ISO-8601（Z 与 +08:00）", () => {
    expect(syncUpdatedAtSchema.safeParse(AT).success).toBe(true);
    expect(syncUpdatedAtSchema.safeParse(SHANGHAI).success).toBe(true);
    expect(syncUpdatedAtSchema.safeParse("2026-08-13T10:00Z").success).toBe(true);
  });

  it("拒绝 naive 时间 / 日期 / 非法值 / 空串 / 非字符串", () => {
    for (const bad of ["2026-08-13", "2026-08-13 10:00:00", "2026-08-13T10:00:00", "not-a-date", "", 12345, null]) {
      expect(syncUpdatedAtSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("syncChangeSchema（按实体 discriminated union）", () => {
  it("11 个实体都接受移动端真实 payload", () => {
    for (const entityType of SYNC_ENTITY_TYPES) {
      const parsed = syncChangeSchema.safeParse(change(entityType, MOBILE_PAYLOADS[entityType], { changeId: "c-1" }));
      expect(parsed.success, entityType).toBe(true);
    }
  });

  it("11 个实体都接受服务端 pull 的 payload（bigint id 为字符串）", () => {
    for (const entityType of SYNC_ENTITY_TYPES) {
      const parsed = syncChangeSchema.safeParse(change(entityType, PULL_PAYLOADS[entityType]));
      expect(parsed.success, entityType).toBe(true);
    }
  });

  it("拒绝白名单外的 entityType", () => {
    expect(syncChangeSchema.safeParse(change("futureEntity", { x: 1 })).success).toBe(false);
  });

  it("非 DELETE 必须有 payload；DELETE 的 payload 必须为 null", () => {
    expect(syncChangeSchema.safeParse(change("progress", null)).success).toBe(false);
    expect(
      syncChangeSchema.safeParse({ ...change("progress", null), operation: "DELETE" }).success
    ).toBe(true);
    expect(
      syncChangeSchema.safeParse({ ...change("progress", { done: true, note: null }), operation: "DELETE" }).success
    ).toBe(false);
  });

  it("拒绝缺字段 / 字段类型错误", () => {
    expect(syncChangeSchema.safeParse(change("tasks", { title: "只有标题" })).success).toBe(false);
    expect(syncChangeSchema.safeParse({ ...change("progress", { done: true, note: null }), entityId: "" }).success).toBe(false);
    expect(syncChangeSchema.safeParse({ ...change("progress", { done: true, note: null }), updatedAt: "昨天" }).success).toBe(false);
  });
});

describe("syncPushSchema / 响应契约", () => {
  it("接受完整 push body，且最多 500 条", () => {
    const body = { deviceId: "dev-1", deviceName: "mobile", changes: [change("progress", MOBILE_PAYLOADS.progress)] };
    expect(syncPushSchema.safeParse(body).success).toBe(true);
    const tooMany = {
      changes: Array.from({ length: SYNC_MAX_CHANGES + 1 }, () => change("progress", MOBILE_PAYLOADS.progress)),
    };
    expect(syncPushSchema.safeParse(tooMany).success).toBe(false);
  });

  it("push 响应 receipts 结构（含 seq）可解析", () => {
    const parsed = syncPushResponseSchema.safeParse({
      ok: true,
      applied: 1,
      receipts: [{ changeId: "c-1", index: 0, result: "applied", reason: "applied", seq: 42 }],
      serverTime: SHANGHAI,
    });
    expect(parsed.success).toBe(true);
  });

  it("pull 响应含 hasMore/cursor 与 serverTime", () => {
    const parsed = syncPullResponseSchema.safeParse({
      changes: [{ entityType: "progress", entityId: "1", operation: "UPDATE", version: 1, payload: { done: true, note: null }, updatedAt: AT }],
      serverTime: SHANGHAI,
      hasMore: false,
      cursor: null,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("parseSyncEntityList", () => {
  it("缺省/null/空串 → 全部实体（null）", () => {
    expect(parseSyncEntityList(undefined)).toEqual({ ok: true, entities: null });
    expect(parseSyncEntityList(null)).toEqual({ ok: true, entities: null });
    expect(parseSyncEntityList("  ,  ")).toEqual({ ok: true, entities: null });
  });

  it("按 SYNC_ENTITY_TYPES 顺序去重返回", () => {
    expect(parseSyncEntityList("logs,tasks,tasks")).toEqual({ ok: true, entities: ["tasks", "logs"] });
  });

  it("未知实体返回 invalid（调用方回 400）", () => {
    expect(parseSyncEntityList("tasks,nope")).toEqual({ ok: false, invalid: ["nope"] });
  });
});
