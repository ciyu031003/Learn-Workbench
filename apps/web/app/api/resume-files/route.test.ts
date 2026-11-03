import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/resume-files", () => ({
  RESUME_MAX_BYTES: 5 * 1024 * 1024,
  validateResumeFile: vi.fn(() => ({ ok: true, ext: "pdf" })),
  resumeRelPath: vi.fn((uid: string, id: string, ext: string) => uid + "/" + id + "." + ext),
  saveResumeFile: vi.fn(async () => undefined),
  contentTypeFor: vi.fn(() => "application/pdf"),
}));

import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { logger } from "@/lib/logger";
import { validateResumeFile } from "@/lib/resume-files";
import { GET, POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userMock = vi.mocked(currentUserId);
const validateMock = vi.mocked(validateResumeFile);
const logErrorMock = vi.mocked(logger.error);

/** 模拟并发写默认撞 uq_resume_files_default（PostgreSQL 23505） */
function uniqueViolation(): Error {
  return Object.assign(new Error('duplicate key value violates unique constraint "uq_resume_files_default"'), {
    code: "23505",
  });
}

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
    queryMock.mockResolvedValue({ rows: [{ id: "1", fileName: "简历.pdf", mime: "application/pdf", bytes: "1234" }] } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.files[0].bytes).toBe(1234);
    // S5-5：登录态业务响应 private, no-store
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    // S5-4 契约：resume-files 列表 id 一律 string
    expect(typeof body.files[0].id).toBe("string");
    expect(body.files[0].id).toBe("1");
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
    queryMock.mockResolvedValue({ rows: [{ id: "9", fileName: "简历.pdf", mime: "application/pdf", bytes: "2048" }] } as never);
    const form = new FormData();
    form.append("file", new File([new Uint8Array(2048)], "简历.pdf", { type: "application/pdf" }));
    const res = await POST(new Request("http://localhost", { method: "POST", body: form }));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("2f1b1f2e-0000-4000-8000-000000000000");
    expect(args[1]).toBe("简历.pdf");
    expect(args[3]).toBe("application/pdf");
    expect(args[4]).toBe(2048);
    // S5-5：登录态业务响应 private, no-store
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("GET /api/resume-files · 标签与默认（P1-5）", () => {
  it("返回 label 与 isDefault；脏 label 归一成 null、缺省 isDefault 归一成 false", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({
      rows: [
        { id: "1", fileName: "后端-社招.pdf", mime: "application/pdf", bytes: "1234", label: "后端", isDefault: true },
        { id: "2", fileName: "通用.pdf", mime: "application/pdf", bytes: "2048", label: "", isDefault: undefined },
      ],
    } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.files[0]).toMatchObject({ label: "后端", isDefault: true });
    expect(body.files[1].label).toBeNull();
    expect(body.files[1].isDefault).toBe(false);
  });

  it("SQL 里带 label / is_default 列（列表契约）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET();
    expect(queryMock.mock.calls[0][0]).toEqual(expect.stringContaining("label"));
    expect(queryMock.mock.calls[0][0]).toEqual(expect.stringContaining('is_default AS "isDefault"'));
  });
});

describe("POST /api/resume-files · 首个上传自动默认（P1-5）", () => {
  it("INSERT 带 is_default 的 NOT EXISTS 子查询（首份自动成为默认）", async () => {
    userMock.mockResolvedValue("2f1b1f2e-0000-4000-8000-000000000000");
    queryMock.mockResolvedValue({
      rows: [{ id: "9", fileName: "简历.pdf", mime: "application/pdf", bytes: "2048", label: null, isDefault: true }],
    } as never);
    const form = new FormData();
    form.append("file", new File([new Uint8Array(2048)], "简历.pdf", { type: "application/pdf" }));
    const res = await POST(new Request("http://localhost", { method: "POST", body: form }));
    expect(res.status).toBe(201);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("is_default");
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM resume_files WHERE user_id = $1 AND deleted_at IS NULL)");
    const body = await res.json();
    expect(body.file.isDefault).toBe(true);
    expect(body.file.label).toBeNull();
  });
});

describe("GET /api/resume-files · 默认简历回溯（P2-1）", () => {
  const row = (id: string, isDefault = false) => ({
    id,
    fileName: "简历-" + id + ".pdf",
    mime: "application/pdf",
    bytes: "1024",
    label: null,
    isDefault,
  });

  it("有简历但没有任何默认 → 自动把最新一份（列表首行）设为默认，本次响应同步标记", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({ rows: [row("9"), row("3")] } as never) // SELECT
      .mockResolvedValueOnce({ rows: [{ id: "9" }] } as never); // 回溯 UPDATE
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.files[0].isDefault).toBe(true);
    expect(body.files[1].isDefault).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(2);
    const [sql, args] = queryMock.mock.calls[1];
    // 原子提升：单条带 CTE 的 UPDATE，判定（NOT EXISTS）与写入同语句
    expect(String(sql)).toContain("WITH candidate AS");
    expect(String(sql)).toContain("SET is_default = true");
    expect(String(sql)).toContain("NOT EXISTS");
    expect(String(sql)).toContain("ORDER BY created_at DESC, id DESC");
    expect(args).toEqual(["u-1"]);
  });

  it("已有默认 → 不再回溯（只查一次库）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValueOnce({ rows: [row("9", true), row("3")] } as never);
    const body = await (await GET()).json();
    expect(body.files[0].isDefault).toBe(true);
    expect(body.files[1].isDefault).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("空列表 → 不执行回溯（无简历可提升）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const body = await (await GET()).json();
    expect(body.files).toEqual([]);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("回溯失败 → 列表仍 200（catch 记日志，下次读取再试）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({ rows: [row("9")] } as never)
      .mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.files[0].isDefault).toBe(false);
    expect(logErrorMock).toHaveBeenCalled();
  });

  it("并发唯一冲突（23505）一次 → 退避重试成功，本次响应同步标记", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({ rows: [row("9"), row("3")] } as never) // SELECT
      .mockRejectedValueOnce(uniqueViolation()) // 并发把默认让给了别人
      .mockResolvedValueOnce({ rows: [{ id: "9" }] } as never); // 重试成功
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.files[0].isDefault).toBe(true);
    expect(body.files[1].isDefault).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("唯一冲突重试耗尽 → 只记日志，列表仍 200（本次不标记默认）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({ rows: [row("9")] } as never) // SELECT
      .mockRejectedValueOnce(uniqueViolation())
      .mockRejectedValueOnce(uniqueViolation())
      .mockRejectedValueOnce(uniqueViolation());
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.files[0].isDefault).toBe(false);
    // 1 次 SELECT + 3 次尝试（首次 + 2 次退避重试）
    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    // 登录态响应头也保持不变
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});


