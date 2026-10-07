import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DIAGNOSTIC_MAX_BYTES,
  diagnosticRelPath,
  diagnosticsRootDir,
  isSafeDiagnosticOwner,
  isSafeDiagnosticPath,
  pruneDiagnosticReports,
  redactDiagnosticsText,
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

describe("redactDiagnosticsText（服务端兜底脱敏）", () => {
  it("抹掉 Bearer / 长串 / 邮箱 / 手机号", () => {
    const out = redactDiagnosticsText(
      "Authorization: Bearer " + "A".repeat(40) + " mail zzz@example.com tel 13800138000"
    );
    expect(out).not.toContain("A".repeat(40));
    expect(out).not.toContain("zzz@example.com");
    expect(out).not.toContain("13800138000");
    expect(out).toContain("<redacted");
  });

  it("长连续串线性处理（不退化）", () => {
    const t0 = Date.now();
    redactDiagnosticsText("x".repeat(200000));
    expect(Date.now() - t0).toBeLessThan(400);
  });
});

describe("pruneDiagnosticReports（30 天保留策略）", () => {
  it("删除过期文件、保留新文件并清掉清空后的归属目录", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "lwb-diag-"));
    const prev = process.env.DIAGNOSTICS_DIR;
    process.env.DIAGNOSTICS_DIR = root;
    try {
      const ownerDir = path.join(root, "u-1");
      mkdirSync(ownerDir, { recursive: true });
      const oldFile = path.join(ownerDir, "aaaaaaaa-1111-2222-3333-444444444444.json");
      const newFile = path.join(ownerDir, "bbbbbbbb-1111-2222-3333-444444444444.json");
      writeFileSync(oldFile, "{}", "utf8");
      writeFileSync(newFile, "{}", "utf8");
      const oldTime = (Date.now() - 40 * 24 * 3600 * 1000) / 1000;
      utimesSync(oldFile, oldTime, oldTime);

      const owner2 = path.join(root, "u-2");
      mkdirSync(owner2, { recursive: true });
      const onlyOld = path.join(owner2, "cccccccc-1111-2222-3333-444444444444.json");
      writeFileSync(onlyOld, "{}", "utf8");
      utimesSync(onlyOld, oldTime, oldTime);

      const res = await pruneDiagnosticReports(30);
      expect(res.files).toBe(2);
      expect(existsSync(oldFile)).toBe(false);
      expect(existsSync(newFile)).toBe(true);
      // u-2 里唯一的文件被删 → 目录也一起清掉
      expect(existsSync(owner2)).toBe(false);
      expect(existsSync(ownerDir)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DIAGNOSTICS_DIR;
      else process.env.DIAGNOSTICS_DIR = prev;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("目录不存在时安全返回（没人上传过）", async () => {
    const prev = process.env.DIAGNOSTICS_DIR;
    process.env.DIAGNOSTICS_DIR = path.join(tmpdir(), "lwb-diag-missing-" + Date.now());
    try {
      const res = await pruneDiagnosticReports(30);
      expect(res).toEqual({ files: 0, dirs: 0 });
    } finally {
      if (prev === undefined) delete process.env.DIAGNOSTICS_DIR;
      else process.env.DIAGNOSTICS_DIR = prev;
    }
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
