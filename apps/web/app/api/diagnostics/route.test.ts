import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/diagnostics-store", () => ({
  validateDiagnosticBody: vi.fn(() => ({ ok: true, bytes: 12 })),
  diagnosticRelPath: vi.fn((uid: string, id: string) => uid + "/" + id + ".json"),
  saveDiagnosticReport: vi.fn(async () => undefined),
}));

import { currentUserId } from "@/lib/session";
import { diagnosticRelPath, saveDiagnosticReport, validateDiagnosticBody } from "@/lib/diagnostics-store";
import { POST } from "./route";

const userMock = vi.mocked(currentUserId);
const validateMock = vi.mocked(validateDiagnosticBody);
const saveMock = vi.mocked(saveDiagnosticReport);

const req = (body = "{}", method = "POST") =>
  new Request("http://localhost/api/diagnostics", { method, body, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetAllMocks();
  validateMock.mockReturnValue({ ok: true, bytes: 12 });
  vi.mocked(diagnosticRelPath).mockImplementation((uid: string, id: string) => uid + "/" + id + ".json");
  saveMock.mockResolvedValue(undefined);
});

describe("POST /api/diagnostics", () => {
  it("未登录 401，且不落盘", async () => {
    userMock.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("正文不合法时按 store 给出的状态码回错", async () => {
    userMock.mockResolvedValue("u-1");
    validateMock.mockReturnValue({ ok: false, error: "诊断包不是合法 JSON", status: 400 });
    const res = await POST(req("not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("合法 JSON");
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("超过上限回 413（与客户端 REPORT_MAX_BYTES 同口径）", async () => {
    userMock.mockResolvedValue("u-1");
    validateMock.mockReturnValue({ ok: false, error: "诊断包太大了（上限 512KB）", status: 413 });
    const res = await POST(req("x"));
    expect(res.status).toBe(413);
  });

  it("成功时按 userId 分目录落盘并回 id", async () => {
    userMock.mockResolvedValue("u-9");
    const res = await POST(req('{"kind":"crash"}'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.bytes).toBe(12);
    expect(typeof body.id).toBe("string");
    expect(saveMock).toHaveBeenCalledTimes(1);
    const [rel, raw] = saveMock.mock.calls[0];
    expect(rel.startsWith("u-9/")).toBe(true);
    expect(rel.endsWith(".json")).toBe(true);
    expect(raw).toBe('{"kind":"crash"}');
  });

  it("落盘失败回 500（不让异常冒成 HTML 500）", async () => {
    userMock.mockResolvedValue("u-9");
    saveMock.mockRejectedValue(new Error("disk full"));
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("保存失败");
  });

  it("GET 不提供（只写不读，读取走 ssh / 管理员）", async () => {
    const mod = await import("./route");
    expect("GET" in mod).toBe(false);
  });
});
