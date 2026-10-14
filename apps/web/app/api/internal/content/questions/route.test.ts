import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(async () => {}) }));
vi.mock("@/lib/content/content-editor", () => ({
  listQuestions: vi.fn(async () => ({ rows: [], total: 0, limit: 50, offset: 0 })),
  normalizeQuestionPatch: vi.fn(() => ({ ok: true, patch: { stem: "新题干" } })),
  updateQuestion: vi.fn(async () => ({ ok: true })),
}));
import { listQuestions, normalizeQuestionPatch, updateQuestion } from "@/lib/content/content-editor";
import { GET, PATCH } from "./route";

const listMock = vi.mocked(listQuestions);
const normalizeMock = vi.mocked(normalizeQuestionPatch);
const updateMock = vi.mocked(updateQuestion);

function req(method: "GET" | "PATCH", body?: unknown, secret = "s3cr3t", query = "") {
  return new Request("http://localhost/api/internal/content/questions" + query, {
    method,
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
    body: method === "PATCH" ? JSON.stringify(body ?? {}) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
  listMock.mockResolvedValue({ rows: [], total: 0, limit: 50, offset: 0 });
  normalizeMock.mockReturnValue({ ok: true, patch: { stem: "新题干" } } as never);
  updateMock.mockResolvedValue({ ok: true } as never);
});

describe("/api/internal/content/questions", () => {
  it("没有密钥时一律 403（GET 与 PATCH）", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("GET", undefined, "wrong"))).status).toBe(403);
    process.env.CRON_SECRET = "s3cr3t";
    expect((await PATCH(req("PATCH", { key: "q1" }, "wrong"))).status).toBe(403);
  });

  it("GET 透传筛选参数并返回分页结果", async () => {
    const res = await GET(req("GET", undefined, "s3cr3t", "?q=索引&track=algorithms&limit=10&offset=5"));
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith({ q: "索引", track: "algorithms", status: undefined, level: undefined, limit: 10, offset: 5 });
    expect(await res.json()).toMatchObject({ ok: true, total: 0 });
  });

  it("PATCH 缺 key → 400，且不落库", async () => {
    const res = await PATCH(req("PATCH", { patch: { stem: "x" } }));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PATCH 校验失败 → 400，且不落库", async () => {
    normalizeMock.mockReturnValueOnce({ ok: false, error: "答案不在选项里" } as never);
    const res = await PATCH(req("PATCH", { key: "q1", patch: { answer: ["Z"] } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "答案不在选项里" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PATCH 空 patch → 400", async () => {
    normalizeMock.mockReturnValueOnce({ ok: true, patch: {} } as never);
    expect((await PATCH(req("PATCH", { key: "q1", patch: {} }))).status).toBe(400);
  });

  it("PATCH 成功 → 200 并回报改动字段", async () => {
    const res = await PATCH(req("PATCH", { key: "q1", patch: { stem: "新题干" } }));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("q1", { stem: "新题干" });
    expect(await res.json()).toMatchObject({ ok: true, key: "q1", fields: ["stem"] });
  });

  it("题目不存在 → 404；其它失败 → 400", async () => {
    updateMock.mockResolvedValueOnce({ ok: false, error: "题目不存在" } as never);
    expect((await PATCH(req("PATCH", { key: "nope" }))).status).toBe(404);
    updateMock.mockResolvedValueOnce({ ok: false, error: "已发布题必须有解析" } as never);
    expect((await PATCH(req("PATCH", { key: "q1" }))).status).toBe(400);
  });

  it("数据库异常 → 500 且不泄漏内部细节", async () => {
    updateMock.mockRejectedValueOnce(new Error("connection refused: 127.0.0.1"));
    const res = await PATCH(req("PATCH", { key: "q1" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("127.0.0.1");
  });
});
