import { describe, it, expect, afterEach } from "vitest";
import {
  DIAGNOSTIC_MAX_BYTES,
  diagnosticRelPath,
  diagnosticsRootDir,
  isSafeDiagnosticOwner,
  isSafeDiagnosticPath,
  validateDiagnosticBody,
} from "./diagnostics-store";

describe("validateDiagnosticBody", () => {
  it("空请求体 400", () => {
    const r = validateDiagnosticBody("");
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("非法 JSON 400", () => {
    const r = validateDiagnosticBody("{oops");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("合法 JSON");
  });

  it("数组不算诊断包 400", () => {
    const r = validateDiagnosticBody("[1,2]");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON 对象");
  });

  it("超过 512KB 直接 413（先看字节数，不先 JSON.parse）", () => {
    const r = validateDiagnosticBody(JSON.stringify({ big: "x".repeat(DIAGNOSTIC_MAX_BYTES) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });

  it("合法对象返回字节数", () => {
    const r = validateDiagnosticBody('{"kind":"crash"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bytes).toBe(Buffer.byteLength('{"kind":"crash"}', "utf8"));
  });
});

describe("路径安全", () => {
  it("owner 只允许安全字符", () => {
    expect(isSafeDiagnosticOwner("3f1c2b7e-0000-4000-8000-abcdefabcdef")).toBe(true);
    expect(isSafeDiagnosticOwner("anon-1234abcd")).toBe(true);
    expect(isSafeDiagnosticOwner("../etc")).toBe(false);
    expect(isSafeDiagnosticOwner("a/b")).toBe(false);
    expect(isSafeDiagnosticOwner("")).toBe(false);
  });

  it("拒绝穿越 / 绝对路径 / 反斜杠", () => {
    expect(isSafeDiagnosticPath("u-1/123e4567-e89b-12d3-a456-426614174000.json")).toBe(true);
    expect(isSafeDiagnosticPath("../u-1/x.json")).toBe(false);
    expect(isSafeDiagnosticPath("/u-1/x.json")).toBe(false);
    expect(isSafeDiagnosticPath("u-1\\x.json")).toBe(false);
    expect(isSafeDiagnosticPath("u-1/x.txt")).toBe(false);
  });

  it("relPath 是 owner/id.json", () => {
    expect(diagnosticRelPath("u-1", "abc12345")).toBe("u-1/abc12345.json");
  });
});

describe("diagnosticsRootDir", () => {
  const prev = process.env.DIAGNOSTICS_DIR;
  afterEach(() => {
    if (prev === undefined) delete process.env.DIAGNOSTICS_DIR;
    else process.env.DIAGNOSTICS_DIR = prev;
  });

  it("DIAGNOSTICS_DIR 优先", () => {
    process.env.DIAGNOSTICS_DIR = "/tmp/diag";
    expect(diagnosticsRootDir()).toBe("/tmp/diag");
  });

  it("默认落在 UPLOAD_DIR 同级的 private/diagnostics", () => {
    delete process.env.DIAGNOSTICS_DIR;
    process.env.UPLOAD_DIR = "/srv/public/uploads";
    expect(diagnosticsRootDir().replace(/\\/g, "/")).toBe("/srv/public/private/diagnostics");
    delete process.env.UPLOAD_DIR;
  });
});
