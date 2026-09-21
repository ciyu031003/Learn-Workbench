import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), userIdFromToken: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn(async () => Buffer.from("PDFDATA")) }));
vi.mock("@/lib/resume-files", () => ({
  contentTypeFor: () => "application/pdf",
  resumeExtOf: () => "pdf",
  isSafeResumePath: (p: string) => p.startsWith("2f1b1f2e-"),
  resumeAbsPath: (p: string) => "/tmp/" + p,
  removeResumeFile: vi.fn(async () => undefined),
}));

import { pgPool } from "@/lib/db";
import { currentUserId, userIdFromToken } from "@/lib/session";
import { GET, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userMock = vi.mocked(currentUserId);
const tokenMock = vi.mocked(userIdFromToken);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  queryMock.mockResolvedValue({ rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf", fileName: "简历.pdf", mime: "application/pdf" }] } as never);
});

describe("GET /api/resume-files/[id]", () => {
  it("未登录 401", async () => {
    userMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), ctx("1"));
    expect(res.status).toBe(401);
  });

  it("用 ?token= 也能取（移动端预览）", async () => {
    tokenMock.mockResolvedValue("u-1");
    const res = await GET(new Request("http://localhost/api/resume-files/1?token=abc"), ctx("1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("不是本人 / 不存在 → 404", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost"), ctx("1"));
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
