import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })) }));
vi.mock("@/lib/diagnostics-store", () => ({
  validateDiagnosticBody: vi.fn(() => ({ ok: true, bytes: 12 })),
  diagnosticRelPath: vi.fn((uid: string, id: string) => uid + "/" + id + ".json"),
  saveDiagnosticReport: vi.fn(async () => undefined),
  redactDiagnosticsText: vi.fn((t: string) => "R(" + t + ")"),
}));

import { currentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import {
  diagnosticRelPath,
  redactDiagnosticsText,
  saveDiagnosticReport,
  validateDiagnosticBody,
} from "@/lib/diagnostics-store";
import { POST } from "./route";

const userMock = vi.mocked(currentUserId);
const limitMock = vi.mocked(rateLimit);
const validateMock = vi.mocked(validateDiagnosticBody);
const saveMock = vi.mocked(saveDiagnosticReport);

const req = (body = "{}", method = "POST") =>
  new Request("http://localhost/api/diagnostics", { method, body, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetAllMocks();
  limitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  vi.mocked(redactDiagnosticsText).mockImplementation((t: string) => "R(" + t + ")");
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

  it("成功时按 userId 分目录落盘并回 id（落盘内容经服务端兜底脱敏）", async () => {
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
    // 2026-10-07 评审：服务端必须兜底脱敏，不能只信客户端
    expect(redactDiagnosticsText).toHaveBeenCalledWith('{"kind":"crash"}');
    expect(raw).toBe('R({"kind":"crash"})');
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("超过限流阈值回 429 + Retry-After（512KB 级写入必须有闸门）", async () => {
    userMock.mockResolvedValue("u-9");
    limitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 1234 });
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("1234");
    expect((await res.json()).error).toContain("太频繁");
    expect(saveMock).not.toHaveBeenCalled();
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
