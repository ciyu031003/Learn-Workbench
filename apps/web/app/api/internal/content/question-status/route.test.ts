import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/content/question-lifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/question-lifecycle")>();
  return { ...actual, setQuestionStatus: vi.fn() };
});
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(async () => {}), listAuditLog: vi.fn() }));
import { setQuestionStatus } from "@/lib/content/question-lifecycle";
import { POST } from "./route";

const setMock = vi.mocked(setQuestionStatus);

function req(body: unknown, secret: string | null = "s3cr3t"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["x-cron-secret"] = secret;
  return new Request("http://localhost/api/internal/content/question-status", {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
  setMock.mockResolvedValue(true);
});

describe("POST /api/internal/content/question-status", () => {
  it("无密钥 / 错密钥 → 403", async () => {
    expect((await POST(req({ key: "py-q1", status: "archived" }, null))).status).toBe(403);
    expect((await POST(req({ key: "py-q1", status: "archived" }, "wrong"))).status).toBe(403);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("非法状态 → 400", async () => {
    const res = await POST(req({ key: "py-q1", status: "publishedd" }));
    expect(res.status).toBe(400);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("缺 key → 400", async () => {
    expect((await POST(req({ status: "archived" }))).status).toBe(400);
  });

  it("合法请求改状态并回显", async () => {
    const res = await POST(req({ key: "py-q1", status: "archived" }));
    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalledWith("py-q1", "archived");
    expect(await res.json()).toMatchObject({ ok: true, key: "py-q1", status: "archived" });
  });

  it("题目不存在 → 404", async () => {
    setMock.mockResolvedValue(false);
    expect((await POST(req({ key: "ghost", status: "draft" }))).status).toBe(404);
  });
});
