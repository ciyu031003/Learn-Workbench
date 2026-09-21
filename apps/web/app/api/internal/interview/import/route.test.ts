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
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("Java 并发");
    expect(args[3]).toBe("hard");
    expect(args[4]).toBe(JSON.stringify(["并发", "基础"]));
    expect(args[6]).toBe("github:Snailclimb/JavaGuide");
    expect(args[7]).toBe("Apache-2.0");
  });

  it("缺 module / 题目太短 / 缺去重键 → 跳过且不写库", async () => {
    const res = await POST(
      req({ items: [{ module: "", question: "短", externalKey: "" }, { module: "X", question: "问题够长了没问题", externalKey: "" }] })
    );
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.skipped.length).toBe(2);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("非法难度回落 medium", async () => {
    await POST(req({ items: [{ module: "M", question: "这是一个足够长的问题？", externalKey: "k2", difficulty: "impossible" }] }));
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[3]).toBe("medium");
  });
});
