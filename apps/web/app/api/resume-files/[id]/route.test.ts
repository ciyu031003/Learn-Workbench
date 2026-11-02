import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/file-ticket", () => ({ verifyFileTicket: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn(async () => Buffer.from("PDFDATA")) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/resume-files", () => ({
  contentTypeFor: () => "application/pdf",
  // 按存储路径推扩展名：docx 用例要能拿到 "docx"（与 lib/resume-files.ts 的 resumeExtOf 同义）
  resumeExtOf: (p: string) => (String(p).toLowerCase().endsWith(".docx") ? "docx" : String(p).toLowerCase().endsWith(".doc") ? "doc" : "pdf"),
  isSafeResumePath: (p: string) => p.startsWith("2f1b1f2e-"),
  resumeAbsPath: (p: string) => "/tmp/" + p,
  removeResumeFile: vi.fn(async () => undefined),
}));

import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { logger } from "@/lib/logger";
import { verifyFileTicket } from "@/lib/file-ticket";
import { GET, DELETE, PATCH } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const logErrorMock = vi.mocked(logger.error);
const userMock = vi.mocked(currentUserId);
const ticketMock = vi.mocked(verifyFileTicket);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  queryMock.mockResolvedValue({ rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf", fileName: "简历.pdf", mime: "application/pdf" }] } as never);
  // 默认给一个「池化客户端」把语句转给 queryMock；默认互斥用例会换成专用 client 以断言 BEGIN/COMMIT
  connectMock.mockResolvedValue({ query: queryMock, release: vi.fn() } as never);
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

  it("删的是默认简历 → 自动提升剩余最新一份为默认（返回 promoted）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({
        rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf", isDefault: true }],
      } as never)
      .mockResolvedValueOnce({ rows: [{ id: "7" }] } as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.promoted).toBe("7");
    expect(queryMock).toHaveBeenCalledTimes(2);
    const [sql, args] = queryMock.mock.calls[1];
    expect(String(sql)).toContain("UPDATE resume_files SET is_default = true");
    expect(String(sql)).toContain("NOT EXISTS");
    expect(args).toEqual(["u-1"]);
  });

  it("删的不是默认 → 不触发提升（只有删除那条 UPDATE）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValueOnce({
      rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf", isDefault: false }],
    } as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    const body = await res.json();
    expect(body.promoted).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("删完最后一份（是默认但没有剩余）→ promoted 为 null，删除照常成功", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({
        rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf", isDefault: true }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    expect((await res.json()).promoted).toBeNull();
  });

  it("提升失败 → 删除仍成功（200 ok / promoted null / 记日志，下次 GET 自愈）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({
        rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf", isDefault: true }],
      } as never)
      .mockRejectedValueOnce(new Error("db down"));
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.promoted).toBeNull();
    expect(logErrorMock).toHaveBeenCalled();
  });
});

describe("PATCH /api/resume-files/[id]（重命名）", () => {
  const patch = (fileName: unknown) =>
    PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      }),
      ctx("1")
    );

  it("未登录 → 401", async () => {
    userMock.mockResolvedValue(null);
    const res = await patch("新名字.pdf");
    expect(res.status).toBe(401);
  });

  it("fileName 缺失 / 非字符串 → 400", async () => {
    userMock.mockResolvedValue("u-1");
    expect((await patch(undefined)).status).toBe(400);
    expect((await patch(123)).status).toBe(400);
  });

  it("空白或只剩控制字符 → 400", async () => {
    userMock.mockResolvedValue("u-1");
    expect((await patch("   ")).status).toBe(400);
    expect((await patch("\n\r\t")).status).toBe(400);
  });

  it("不是本人 / 不存在 → 404", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await patch("新名字.pdf");
    expect(res.status).toBe(404);
  });

  it("没写扩展名 → 沿用原扩展；带换行的输入被压成空格", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({
      rows: [
        { path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf" },
        { fileName: "秋招-后端.pdf" },
      ],
    } as never);
    const res = await patch("秋招\r\n后端简历");
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(d.fileName).toBe("秋招 后端简历.pdf");
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE resume_files SET file_name = $3"),
      expect.arrayContaining(["秋招 后端简历.pdf"])
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("自己带了扩展名（大小写与原扩展一致）→ 不重复追加，保留用户写法", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({
      rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf" }, { fileName: "x.pdf" }],
    } as never);
    const res = await patch("社招-V2.PDF");
    expect((await res.json()).fileName).toBe("社招-V2.PDF");
  });

  it("带点但不是扩展名的名字（简历 v2.0）→ 仍补上原扩展（回归：旧实现会误判 .0 为扩展名）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({
      rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf" }, { fileName: "x.pdf" }],
    } as never);
    const res = await patch("后端-简历 v2.0");
    expect(res.status).toBe(200);
    expect((await res.json()).fileName).toBe("后端-简历 v2.0.pdf");
  });

  it("写了别的合法扩展名（pdf 文件写成 .docx）→ 以原扩展为准", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({
      rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf" }, { fileName: "x.pdf" }],
    } as never);
    const res = await patch("秋招-后端.docx");
    expect(res.status).toBe(200);
    expect((await res.json()).fileName).toBe("秋招-后端.pdf");
  });

  it("禁止路径分隔符（/ 与 \\）→ 400，且不写库", async () => {
    userMock.mockResolvedValue("u-1");
    const slash = await patch("秋招/后端.pdf");
    expect(slash.status).toBe(400);
    expect((await slash.json()).error).toContain("不能包含");
    const backslash = await patch("秋招\\后端.pdf");
    expect(backslash.status).toBe(400);
    // 只有两次 SELECT（每次请求 1 次）之前就返回了，UPDATE 不应发生
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes("UPDATE resume_files SET file_name"))).toBe(false);
  });

  it("超过 80 字符（含扩展名）→ 400；刚好 80 字符 → 200", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({
      rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf" }, { fileName: "x.pdf" }],
    } as never);
    const tooLong = await patch("a".repeat(77) + ".pdf"); // 81 字符
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).error).toContain("80");
    const exact = await patch("a".repeat(76) + ".pdf"); // 80 字符
    expect(exact.status).toBe(200);
    expect((await exact.json()).fileName).toBe("a".repeat(76) + ".pdf");
  });

  it("空白折叠 + 去首尾点：'  .秋招   后端.  ' → '秋招 后端.pdf'", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({
      rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf" }, { fileName: "x.pdf" }],
    } as never);
    const res = await patch("  .秋招   后端.  ");
    expect(res.status).toBe(200);
    expect((await res.json()).fileName).toBe("秋招 后端.pdf");
  });

  it("存储路径是 docx 时，补的是 .docx 而不是 .pdf", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({
      rows: [{ path: "2f1b1f2e-0000-4000-8000-000000000000/abc.docx" }, { fileName: "x.docx" }],
    } as never);
    const res = await patch("社招-后端");
    expect(res.status).toBe(200);
    expect((await res.json()).fileName).toBe("社招-后端.docx");
  });
});

describe("PATCH /api/resume-files/[id]（领域标签 / 默认简历 · P1-5）", () => {
  const patchBody = (body: unknown) =>
    PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      ctx("1")
    );

  const row = (overrides: Record<string, unknown> = {}) => ({
    path: "2f1b1f2e-0000-4000-8000-000000000000/abc.pdf",
    fileName: "简历.pdf",
    label: null,
    isDefault: false,
    ...overrides,
  });

  it("label 白名单内（含首尾空白）→ 200，返回归一后的标签", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({ rows: [row()] } as never)
      .mockResolvedValueOnce({ rows: [{ fileName: "简历.pdf", label: "后端", isDefault: false }] } as never);
    const res = await patchBody({ label: " 后端 " });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.label).toBe("后端");
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("label = $3"),
      [1, "u-1", "后端"]
    );
  });

  it("label 不在白名单 → 400，且不写库", async () => {
    userMock.mockResolvedValue("u-1");
    const res = await patchBody({ label: "全栈" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("后端");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("label: null / 空串 → 清除标签（写 NULL）", async () => {
    userMock.mockResolvedValue("u-1");
    for (const clear of [null, "", "   "]) {
      queryMock
        .mockResolvedValueOnce({ rows: [row({ label: "算法" })] } as never)
        .mockResolvedValueOnce({ rows: [{ fileName: "简历.pdf", label: null, isDefault: false }] } as never);
      const res = await patchBody({ label: clear });
      expect(res.status).toBe(200);
      expect((await res.json()).label).toBeNull();
      expect(queryMock).toHaveBeenLastCalledWith(
        expect.stringContaining("label = $3"),
        [1, "u-1", null]
      );
    }
  });

  it("空 body / 只有未知字段 → 400（没有可更新字段）", async () => {
    userMock.mockResolvedValue("u-1");
    expect((await patchBody({})).status).toBe(400);
    expect((await patchBody({ foo: 1 })).status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("isDefault 非布尔 → 400", async () => {
    userMock.mockResolvedValue("u-1");
    expect((await patchBody({ isDefault: "yes" })).status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("isDefault: true → 同事务先清其它默认再置本条（BEGIN → clear → update → COMMIT）", async () => {
    userMock.mockResolvedValue("u-1");
    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // 清其它默认
      .mockResolvedValueOnce({ rows: [{ fileName: "简历.pdf", label: null, isDefault: true }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const release = vi.fn();
    connectMock.mockResolvedValue({ query: clientQuery, release } as never);
    queryMock.mockResolvedValueOnce({ rows: [row()] } as never); // SELECT 前置校验（走池）

    const res = await patchBody({ isDefault: true });
    expect(res.status).toBe(200);
    expect((await res.json()).isDefault).toBe(true);
    expect(clientQuery).toHaveBeenCalledWith("BEGIN");
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE resume_files SET is_default = false"),
      ["u-1", 1]
    );
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("is_default = true"), expect.any(Array));
    expect(clientQuery).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalled();
  });

  it("isDefault: false → 单条 UPDATE 取消默认（不开事务）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({ rows: [row({ isDefault: true })] } as never)
      .mockResolvedValueOnce({ rows: [{ fileName: "简历.pdf", label: null, isDefault: false }] } as never);
    const res = await patchBody({ isDefault: false });
    expect(res.status).toBe(200);
    expect((await res.json()).isDefault).toBe(false);
    expect(connectMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("is_default = false"),
      [1, "u-1"]
    );
  });

  it("fileName + label 组合 → 一条 UPDATE 同时改两列（$3 文件名、$4 标签）", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({ rows: [row()] } as never)
      .mockResolvedValueOnce({ rows: [{ fileName: "秋招-后端.pdf", label: "后端", isDefault: false }] } as never);
    const res = await patchBody({ fileName: "秋招-后端", label: "后端" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fileName).toBe("秋招-后端.pdf");
    expect(data.label).toBe("后端");
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/UPDATE resume_files SET file_name = \$3, label = \$4/),
      [1, "u-1", "秋招-后端.pdf", "后端"]
    );
  });

  it("未登录 → 401；文件不存在 → 404（标签路径同样适用）", async () => {
    userMock.mockResolvedValue(null);
    expect((await patchBody({ label: "后端" })).status).toBe(401);

    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    expect((await patchBody({ label: "后端" })).status).toBe(404);
  });

  it("响应保持 private, no-store", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock
      .mockResolvedValueOnce({ rows: [row()] } as never)
      .mockResolvedValueOnce({ rows: [{ fileName: "简历.pdf", label: "通用", isDefault: false }] } as never);
    const res = await patchBody({ label: "通用" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

