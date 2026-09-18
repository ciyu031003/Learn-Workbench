import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const uidMock = vi.mocked(currentUserId);
const parseBodyMock = vi.mocked(parseBody);

const MD = ["# 阶段一", "先把环境装好", "## 主题 A", "### 条目 1", "正文"] .join("\n");

function makeClient() {
  const query = vi.fn(async (sql: unknown) => {
    const s = String(sql);
    if (s.includes("MAX(sort_order)")) return { rows: [{ next: 5 }] };
    if (s.includes("INSERT INTO content_phases")) return { rows: [{ id: 11 }] };
    if (s.includes("INSERT INTO content_topics")) return { rows: [{ id: 22 }] };
    return { rows: [] };
  });
  return { query, release: vi.fn() };
}

beforeEach(() => {
  vi.resetAllMocks();
  uidMock.mockResolvedValue("u-1");
  parseBodyMock.mockResolvedValue({ ok: true, data: { markdown: MD } });
  queryMock.mockResolvedValue({ rows: [] } as never);
});

describe("POST /api/roadmap/import（v6 P3-2 MD 导入）", () => {
  it("未登录 401", async () => {
    uidMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("空 markdown 400", async () => {
    parseBodyMock.mockResolvedValue({ ok: true, data: { markdown: "   " } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("dryRun 只解析：返回预览树与统计，不写库", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ value: "english" }] } as never) // settings.career
      .mockResolvedValueOnce({ rows: [{ owner_id: null }] } as never); // careers
    parseBodyMock.mockResolvedValue({ ok: true, data: { markdown: MD, dryRun: true } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.career).toBe("english");
    expect(body.counts).toEqual({ phases: 1, topics: 1, items: 1 });
    expect(body.preview[0].topics[0].items[0].title).toBe("条目 1");
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("导入：事务内写阶段/主题/条目并返回批次", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ owner_id: null }] } as never); // careers（career 显式给出，不再查 settings）
    parseBodyMock.mockResolvedValue({ ok: true, data: { markdown: MD, career: "ict" } });
    const client = makeClient();
    connectMock.mockResolvedValue(client as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.created).toEqual({ phases: 1, topics: 1, items: 1 });
    expect(body.batchId).toMatch(/^md-/);
    const sqls = client.query.mock.calls.map((c) => String(c[0]));
    expect(sqls[0]).toBe("BEGIN");
    expect(sqls).toContain("COMMIT");
    const calls = client.query.mock.calls as unknown as [string, unknown[]][];
    const phaseCall = calls.find((c) => String(c[0]).includes("INSERT INTO content_phases"));
    expect(phaseCall?.[1]).toEqual(["ict", "阶段一", "先把环境装好", 5, "u-1", body.batchId]);
    const itemCall = calls.find((c) => String(c[0]).includes("INSERT INTO content_topic_items"));
    expect(itemCall?.[1]).toEqual([22, "条目 1", "正文", 0]);
    expect(client.release).toHaveBeenCalled();
  });

  it("领域不存在 400", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    parseBodyMock.mockResolvedValue({ ok: true, data: { markdown: MD, career: "nope" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("他人自定义领域 403", async () => {
    queryMock.mockResolvedValue({ rows: [{ owner_id: "other-user" }] } as never);
    parseBodyMock.mockResolvedValue({ ok: true, data: { markdown: MD, career: "theirs" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(403);
  });

  it("没有解析到标题时 400", async () => {
    parseBodyMock.mockResolvedValue({ ok: true, data: { markdown: "纯正文，没有任何标题" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });
});
