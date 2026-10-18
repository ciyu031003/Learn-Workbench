import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/file-ticket", () => ({
  FILE_TICKET_TTL_SECONDS: 300,
  FileTicketConfigError: class FileTicketConfigError extends Error {},
  issueFileTicket: vi.fn(),
}));

import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { FileTicketConfigError, issueFileTicket } from "@/lib/file-ticket";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userMock = vi.mocked(currentUserId);
const issueMock = vi.mocked(issueFileTicket);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  queryMock.mockResolvedValue({ rows: [{ "?column?": 1 }] } as never);
});

describe("POST /api/resume-files/[id]/ticket", () => {
  it("id 非法 → 400", async () => {
    const res = await POST(new Request("http://localhost", { method: "POST" }), ctx("abc"));
    expect(res.status).toBe(400);
    expect(userMock).not.toHaveBeenCalled();
  });

  it("未登录 → 401", async () => {
    userMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), ctx("1"));
    expect(res.status).toBe(401);
    expect(issueMock).not.toHaveBeenCalled();
  });

  it("不是本人的文件 → 404，且不签票", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }), ctx("1"));
    expect(res.status).toBe(404);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM resume_files WHERE id = $1 AND user_id = $2"),
      [1, "u-1"]
    );
    expect(issueMock).not.toHaveBeenCalled();
  });

  it("本人文件 → 返回 {sig, expiresIn: 300}", async () => {
    userMock.mockResolvedValue("u-1");
    issueMock.mockReturnValue("body.mac");
    const res = await POST(new Request("http://localhost", { method: "POST" }), ctx("1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sig: "body.mac", expiresIn: 300 });
    expect(issueMock).toHaveBeenCalledWith(1, "u-1");
  });

  it("生产未配密钥 → 503（不返回半成品票据）", async () => {
    userMock.mockResolvedValue("u-1");
    issueMock.mockImplementation(() => {
      throw new FileTicketConfigError();
    });
    const res = await POST(new Request("http://localhost", { method: "POST" }), ctx("1"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("未配置");
  });

  it("签发异常 → 500", async () => {
    userMock.mockResolvedValue("u-1");
    issueMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await POST(new Request("http://localhost", { method: "POST" }), ctx("1"));
    expect(res.status).toBe(500);
  });
});
