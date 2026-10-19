import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/file-ticket", () => ({ verifyFileTicket: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn(async () => Buffer.from("PDFDATA")) }));
vi.mock("@/lib/resume-files", () => ({
  contentTypeFor: () => "application/pdf",
  resumeExtOf: () => "pdf",
  isSafeResumePath: (p: string) => p.startsWith("2f1b1f2e-"),
  resumeAbsPath: (p: string) => "/tmp/" + p,
  removeResumeFile: vi.fn(async () => undefined),
}));

import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { verifyFileTicket } from "@/lib/file-ticket";
import { GET, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userMock = vi.mocked(currentUserId);
const ticketMock = vi.mocked(verifyFileTicket);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  queryMock.mockResolvedValue({ rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf", fileName: "简历.pdf", mime: "application/pdf" }] } as never);
});

describe("GET /api/resume-files/[id]", () => {
  it("未登录且没有 sig → 401", async () => {
    userMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), ctx("1"));
    expect(res.status).toBe(401);
    expect(ticketMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("不再接受 ?token= 长期会话 token（防 URL 泄漏回归）", async () => {
    userMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/resume-files/1?token=1e2f-session-token"), ctx("1"));
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("合法 sig → 200（inline + 私有缓存）", async () => {
    ticketMock.mockReturnValue({ fileId: 1, uid: "u-1" });
    const res = await GET(new Request("http://localhost/api/resume-files/1?sig=body.mac"), ctx("1"));
    expect(res.status).toBe(200);
    expect(ticketMock).toHaveBeenCalledWith("body.mac");
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("FROM resume_files WHERE id = $1 AND user_id = $2"), [1, "u-1"]);
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    // S5-5：私有内容也不进任何缓存层
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sig 无效/过期 → 401", async () => {
    ticketMock.mockReturnValue(null);
    const res = await GET(new Request("http://localhost/api/resume-files/1?sig=bad"), ctx("1"));
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("sig 对应的 fileId 与 URL id 不符 → 403（票据串文件）", async () => {
    ticketMock.mockReturnValue({ fileId: 2, uid: "u-1" });
    const res = await GET(new Request("http://localhost/api/resume-files/1?sig=body.mac"), ctx("1"));
    expect(res.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("Web 端无 sig 时回落到 cookie/Bearer 会话", async () => {
    userMock.mockResolvedValue("u-1");
    const res = await GET(new Request("http://localhost/api/resume-files/1"), ctx("1"));
    expect(res.status).toBe(200);
    expect(ticketMock).not.toHaveBeenCalled();
  });

  it("id 非法 → 400", async () => {
    const res = await GET(new Request("http://localhost"), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("不是本人 / 不存在 → 404", async () => {
    ticketMock.mockReturnValue({ fileId: 1, uid: "u-1" });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/resume-files/1?sig=body.mac"), ctx("1"));
    expect(res.status).toBe(404);
  });

  it("?download=1 触发下载", async () => {
    userMock.mockResolvedValue("u-1");
    const res = await GET(new Request("http://localhost?download=1"), ctx("1"));
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
  });
});

describe("DELETE /api/resume-files/[id]", () => {
  it("删自己的文件返回 ok", async () => {
    userMock.mockResolvedValue("u-1");
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("找不到 → 404", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(404);
  });
});
