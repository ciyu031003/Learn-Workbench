import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/resume-files", () => ({
  RESUME_MAX_BYTES: 5 * 1024 * 1024,
  validateResumeFile: vi.fn(() => ({ ok: true, ext: "pdf" })),
  resumeRelPath: vi.fn((uid: string, id: string, ext: string) => uid + "/" + id + "." + ext),
  saveResumeFile: vi.fn(async () => undefined),
  contentTypeFor: vi.fn(() => "application/pdf"),
}));

import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { validateResumeFile } from "@/lib/resume-files";
import { GET, POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userMock = vi.mocked(currentUserId);
const validateMock = vi.mocked(validateResumeFile);

beforeEach(() => {
  vi.resetAllMocks();
  validateMock.mockReturnValue({ ok: true, ext: "pdf" });
  queryMock.mockResolvedValue({ rows: [] } as never);
});

describe("GET /api/resume-files", () => {
  it("未登录 401", async () => {
    userMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("返回列表并把 bytes 转成数字", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [{ id: 1, fileName: "简历.pdf", mime: "application/pdf", bytes: "1234" }] } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.files[0].bytes).toBe(1234);
    expect(body.maxBytes).toBe(5 * 1024 * 1024);
  });
});

describe("POST /api/resume-files", () => {
  it("未登录 401", async () => {
    userMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("缺少文件 400", async () => {
    userMock.mockResolvedValue("u-1");
    const form = new FormData();
    const req = new Request("http://localhost", { method: "POST", body: form });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("校验失败时把错误文案透出（400）", async () => {
    userMock.mockResolvedValue("u-1");
    validateMock.mockReturnValue({ ok: false, error: "只支持 PDF / DOC / DOCX" });
    const form = new FormData();
    form.append("file", new File([new Uint8Array(3)], "a.txt", { type: "text/plain" }));
    const res = await POST(new Request("http://localhost", { method: "POST", body: form }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("PDF");
  });

  it("成功上传 201：落库带原始文件名与 mime", async () => {
    userMock.mockResolvedValue("2f1b1f2e-0000-4000-8000-000000000000");
    queryMock.mockResolvedValue({ rows: [{ id: 9, fileName: "简历.pdf", mime: "application/pdf", bytes: "2048" }] } as never);
    const form = new FormData();
    form.append("file", new File([new Uint8Array(2048)], "简历.pdf", { type: "application/pdf" }));
    const res = await POST(new Request("http://localhost", { method: "POST", body: form }));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("2f1b1f2e-0000-4000-8000-000000000000");
    expect(args[1]).toBe("简历.pdf");
    expect(args[3]).toBe("application/pdf");
    expect(args[4]).toBe(2048);
  });
});
