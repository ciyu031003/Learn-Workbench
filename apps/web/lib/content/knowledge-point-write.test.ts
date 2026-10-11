import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import { pgPool } from "@/lib/db";
import {
  getKnowledgePoint,
  normalizeKnowledgePointPatch,
  updateKnowledgePoint,
} from "./knowledge-point-write";

const queryMock = vi.mocked(pgPool.query);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeKnowledgePointPatch（纯校验）", () => {
  it("只接受白名单字段并做 trim / 去重", () => {
    const result = normalizeKnowledgePointPatch({
      title: "  链表的插入  ",
      summary: " 先保存后继 ",
      status: "review",
      tags: [" 链表 ", "链表", "指针"],
      unknownField: "忽略我",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch).toEqual({
        title: "链表的插入",
        summary: "先保存后继",
        status: "review",
        tags: ["链表", "指针"],
      });
    }
  });

  it("空补丁 / 非法状态 / 非数组 tags / 超长标题都被拦下", () => {
    expect(normalizeKnowledgePointPatch(null).ok).toBe(false);
    expect(normalizeKnowledgePointPatch({}).ok).toBe(false);
    expect(normalizeKnowledgePointPatch({ status: "publishedd" }).ok).toBe(false);
    expect(normalizeKnowledgePointPatch({ tags: "链表" }).ok).toBe(false);
    expect(normalizeKnowledgePointPatch({ title: "x".repeat(201) }).ok).toBe(false);
    expect(normalizeKnowledgePointPatch({ title: "   " }).ok).toBe(false);
  });
});

describe("getKnowledgePoint", () => {
  it("返回带 version 的快照，tags 兼容 jsonb 数组", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          key: "algorithms/ds-sort/ds-insertion-sort",
          title: "插入排序",
          summary: "有序区扩张",
          status: "published",
          tags: ["排序", "408"],
          version: 3,
          updated_at: new Date("2026-10-11T00:00:00.000Z"),
          updated_by: "editor-1",
        },
      ],
    } as never);

    const point = await getKnowledgePoint("algorithms/ds-sort/ds-insertion-sort");
    expect(point).toMatchObject({ version: 3, status: "published", tags: ["排序", "408"], updatedBy: "editor-1" });
    expect(point?.updatedAt).toBe("2026-10-11T00:00:00.000Z");
  });

  it("查不到返回 null", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    expect(await getKnowledgePoint("ghost")).toBeNull();
  });
});

describe("updateKnowledgePoint（乐观锁）", () => {
  it("version 命中 → 返回新 version", async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1, rows: [{ version: 5 }] } as never);
    const result = await updateKnowledgePoint({
      key: "k",
      expectedVersion: 4,
      patch: { title: "新标题" },
      actorId: "editor-1",
    });
    expect(result).toEqual({ ok: true, key: "k", version: 5 });
    const [sql, params] = queryMock.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("version = version + 1");
    expect(sql).toContain("WHERE key = $1 AND version = $2");
    expect(params[0]).toBe("k");
    expect(params[1]).toBe(4);
    expect(params[6]).toBe("editor-1");
  });

  it("version 不匹配 → version_conflict 并回传当前值（绝不静默覆盖）", async () => {
    queryMock
      .mockResolvedValueOnce({ rowCount: 0, rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ version: 9 }] } as never);
    const result = await updateKnowledgePoint({ key: "k", expectedVersion: 4, patch: { status: "archived" } });
    expect(result).toEqual({ ok: false, reason: "version_conflict", currentVersion: 9 });
  });

  it("记录不存在 → not_found", async () => {
    queryMock
      .mockResolvedValueOnce({ rowCount: 0, rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    expect(await updateKnowledgePoint({ key: "ghost", expectedVersion: 1, patch: { summary: "x" } })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("expectedVersion 非法直接抛错（不发起查询）", async () => {
    await expect(updateKnowledgePoint({ key: "k", expectedVersion: 0, patch: { summary: "x" } })).rejects.toThrow(
      /expectedVersion/
    );
    expect(queryMock).not.toHaveBeenCalled();
  });
});
