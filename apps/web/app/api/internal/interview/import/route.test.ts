import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);

function req(body: unknown, secret = "s3cret") {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
    body: JSON.stringify(body),
  });
}

/** 按 SQL 文本分派：SELECT 已有题目 / INSERT / UPDATE / 运行记录 */
function fakeDb(existing: { id: number; externalKey: string | null; question: string }[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  queryMock.mockImplementation((async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    calls.push({ sql: s, params: (params ?? []) as unknown[] });
    if (s.includes("SELECT id, external_key")) return { rows: existing };
    if (s.includes("INSERT INTO interview_questions")) return { rows: [{ id: 101 }] };
    return { rows: [] };
  }) as never);
  return calls;
}

const findCall = (calls: { sql: string; params: unknown[] }[], needle: string) =>
  calls.find((c) => c.sql.includes(needle));

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "s3cret";
  queryMock.mockResolvedValue({ rows: [] } as never);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("POST /api/internal/interview/import", () => {
  it("密钥不对直接 403", async () => {
    const res = await POST(req({ items: [{ module: "Java", question: "什么是线程？", externalKey: "k1" }] }, "wrong"));
    expect(res.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("导入一条：落库字段齐全（含来源与 license）", async () => {
    const calls = fakeDb();
    const res = await POST(
      req({
        items: [
          {
            module: "Java 并发",
            question: "什么是线程和进程？",
            answer: "进程是资源分配的基本单位……",
            difficulty: "hard",
            tags: ["并发", "基础"],
            sourceUrl: "https://github.com/Snailclimb/JavaGuide/blob/main/x.md",
            sourceSite: "github:Snailclimb/JavaGuide",
            license: "Apache-2.0",
            externalKey: "github:Snailclimb/JavaGuide#abc",
            crawledAt: "2026-09-21T00:00:00Z",
          },
        ],
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.imported).toBe(1);
    const insert = findCall(calls, "INSERT INTO interview_questions");
    expect(insert).toBeTruthy();
    const args = insert!.params;
    expect(args[0]).toBe("Java 并发");
    expect(args[1]).toBe("什么是线程和进程？");
    expect(args[3]).toBe("hard");
    expect(args[4]).toBe(JSON.stringify(["并发", "基础"]));
    expect(args[6]).toBe("github:Snailclimb/JavaGuide");
    expect(args[7]).toBe("Apache-2.0");
    expect(args[8]).toBe("github:Snailclimb/JavaGuide#abc");
  });

  it("缺去重键时服务端现算（v1.26 起不再跳过）", async () => {
    const calls = fakeDb();
    const body = await (await POST(req({ items: [{ module: "M", question: "这是一个足够长的面试问题？", sourceSite: "s" }] }))).json();
    expect(body.imported).toBe(1);
    const insert = findCall(calls, "INSERT INTO interview_questions");
    expect(String(insert!.params[8])).toMatch(/^s#[0-9a-f]{16}$/);
  });

  it("module 缺失 / 题目太短 → 跳过且不写库", async () => {
    const calls = fakeDb();
    const res = await POST(req({ items: [{ module: "", question: "短" }, { module: "X", question: "短" }] }));
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.skipped.length).toBe(2);
    expect(findCall(calls, "INSERT INTO interview_questions")).toBeUndefined();
  });

  it("非法难度回落 medium", async () => {
    const calls = fakeDb();
    await POST(req({ items: [{ module: "M", question: "这是一个足够长的问题？", externalKey: "k2", difficulty: "impossible" }] }));
    expect(findCall(calls, "INSERT INTO interview_questions")!.params[3]).toBe("medium");
  });

  it("库里已有同一道题（历史旧键）→ 走 UPDATE，不插新行（防重复的核心）", async () => {
    const calls = fakeDb([
      { id: 42, externalKey: "github:Snailclimb/JavaGuide#oldoldoldoldold", question: "什么是 JVM ？" },
    ]);
    const body = await (
      await POST(
        req({
          items: [
            {
              module: "Java",
              question: "什么是　JVM？",
              answer: "x".repeat(80),
              sourceSite: "github:Snailclimb/JavaGuide",
            },
          ],
        })
      )
    ).json();
    expect(body.imported).toBe(1);
    expect(findCall(calls, "INSERT INTO interview_questions")).toBeUndefined();
    const update = findCall(calls, "UPDATE interview_questions");
    expect(update!.params[0]).toBe(42);
  });

  it("同一份 payload 内重复题只入库一次", async () => {
    const calls = fakeDb();
    const body = await (
      await POST(
        req({
          items: [
            { module: "M", question: "重复的问题内容是什么？", sourceSite: "s" },
            { module: "M", question: "重复的问题内容是什么？ ", sourceSite: "s" },
          ],
        })
      )
    ).json();
    expect(body.imported).toBe(1);
    expect(body.duplicateInPayload).toBe(1);
    expect(calls.filter((c) => c.sql.includes("INSERT INTO interview_questions"))).toHaveLength(1);
  });

  it("带 run 回报时可接受空 items，并把运行记录写成终态", async () => {
    const calls = fakeDb();
    const res = await POST(req({ items: [], run: { runId: 9, status: "failed", error: "网络失败" } }));
    expect(res.status).toBe(200);
    const updateRun = findCall(calls, "UPDATE interview_crawl_runs");
    expect(updateRun).toBeTruthy();
    expect(updateRun!.params[0]).toBe(9);
    expect(updateRun!.params[1]).toBe("failed");
  });

  it("既没有 items 也没有 run → 400", async () => {
    const res = await POST(req({ items: [] }));
    expect(res.status).toBe(400);
  });
});
