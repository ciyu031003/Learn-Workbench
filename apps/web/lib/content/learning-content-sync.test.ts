import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { connect: vi.fn() } }));

import { pgPool } from "@/lib/db";
import { buildLearningContentPlan, syncLearningContent } from "./learning-content-sync";

const connectMock = vi.mocked(pgPool.connect);

const VERSION = "abc123456789";
const FINGERPRINT = "f".repeat(64);

function makeClient(metaTable: string | null) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const query = vi.fn((sql: unknown, params?: unknown[]) => {
    const text = String(sql);
    calls.push({ sql: text, params });
    if (text.includes("to_regclass('public.content_meta')")) {
      return Promise.resolve({ rows: [{ table: metaTable }] });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
  return { client: { query, release: vi.fn() }, calls };
}

function metaInsert(calls: Array<{ sql: string; params?: unknown[] }>) {
  return calls.find((c) => c.sql.includes("INSERT INTO content_meta"));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("learning-content-sync · S7-4b 内容版本 marker", () => {
  it("buildLearningContentPlan 透传 contentFingerprint", () => {
    const plan = buildLearningContentPlan(undefined, VERSION, FINGERPRINT);
    expect(plan.contentVersion).toBe(VERSION);
    expect(plan.contentFingerprint).toBe(FINGERPRINT);
    // 不传指纹时保持 undefined（兼容旧调用）
    expect(buildLearningContentPlan(undefined, VERSION).contentFingerprint).toBeUndefined();
  });

  it("同步事务内 upsert content_meta：content_version / content_fingerprint / content_synced_at", async () => {
    const { client, calls } = makeClient("content_meta");
    connectMock.mockResolvedValue(client as never);

    const plan = buildLearningContentPlan(undefined, VERSION, FINGERPRINT);
    await syncLearningContent(plan);

    const insert = metaInsert(calls);
    expect(insert, "应写入 content_meta").toBeTruthy();
    const keys = insert?.params?.[0] as string[];
    const values = insert?.params?.[1] as string[];
    expect(keys).toEqual(["content_version", "content_fingerprint", "content_synced_at"]);
    expect(values[0]).toBe(VERSION);
    expect(values[1]).toBe(FINGERPRINT);
    expect(Number.isNaN(Date.parse(values[2]))).toBe(false);

    // 同一事务：BEGIN 在前、COMMIT 在后
    const sqls = calls.map((c) => c.sql);
    expect(sqls[0]).toBe("BEGIN");
    expect(sqls[calls.length - 1]).toBe("COMMIT");
  });

  it("082 之前的旧库（无 content_meta 表）→ 跳过 marker 写入，不阻断同步", async () => {
    const { client, calls } = makeClient(null);
    connectMock.mockResolvedValue(client as never);

    await syncLearningContent(buildLearningContentPlan(undefined, VERSION, FINGERPRINT));
    expect(metaInsert(calls)).toBeUndefined();
    expect(calls.map((c) => c.sql)).toContain("COMMIT");
  });

  it("版本为 unknown 时不写 content_version（避免假 marker），指纹仍写入", async () => {
    const { client, calls } = makeClient("content_meta");
    connectMock.mockResolvedValue(client as never);

    await syncLearningContent(buildLearningContentPlan(undefined, "unknown", FINGERPRINT));
    const insert = metaInsert(calls);
    const keys = insert?.params?.[0] as string[];
    expect(keys).toEqual(["content_fingerprint", "content_synced_at"]);
  });
});
