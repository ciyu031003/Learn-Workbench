import { describe, it, expect } from "vitest";
import {
  UPLOAD_MAX_BYTES,
  isSafeUploadPath,
  normalizeUploadKind,
  uploadUrlFor,
  validateUpload,
} from "./uploads";

describe("normalizeUploadKind", () => {
  it("只接受白名单里的类别，其余归 other", () => {
    expect(normalizeUploadKind("avatar")).toBe("avatar");
    expect(normalizeUploadKind("  RACKET ")).toBe("racket");
    expect(normalizeUploadKind("shoes")).toBe("shoes");
    expect(normalizeUploadKind("../../etc")).toBe("other");
    expect(normalizeUploadKind(null)).toBe("other");
    expect(normalizeUploadKind(123)).toBe("other");
  });
});

describe("validateUpload", () => {
  it("放行常见手机图片格式", () => {
    expect(validateUpload({ size: 1024, type: "image/jpeg" }).ok).toBe(true);
    expect(validateUpload({ size: 1024, type: "image/png" }).ok).toBe(true);
    expect(validateUpload({ size: 1024, type: "image/webp" }).ok).toBe(true);
    expect(validateUpload({ size: 1024, type: "image/heic" }).ok).toBe(true);
  });

  it("拒绝空文件 / 超大文件 / 非图片", () => {
    expect(validateUpload({ size: 0, type: "image/png" }).ok).toBe(false);
    expect(validateUpload({ size: UPLOAD_MAX_BYTES + 1, type: "image/png" }).ok).toBe(false);
    expect(validateUpload({ size: 1024, type: "image/gif" }).ok).toBe(false);
    expect(validateUpload({ size: 1024, type: "application/pdf" }).ok).toBe(false);
  });
});

describe("isSafeUploadPath / uploadUrlFor", () => {
  it("只接受 <uuid>/<name>.webp 形态", () => {
    const ok = "11111111-2222-3333-4444-555555555555/abc.webp";
    expect(isSafeUploadPath(ok)).toBe(true);
    expect(isSafeUploadPath("../../etc/passwd")).toBe(false);
    expect(isSafeUploadPath("/abs/path.webp")).toBe(false);
    expect(isSafeUploadPath("11111111-2222-3333-4444-555555555555/abc.png")).toBe(false);
    expect(isSafeUploadPath("not-a-uuid/abc.webp")).toBe(false);
  });

  it("相对路径拼成站内 URL", () => {
    expect(uploadUrlFor("u/abc.webp")).toBe("/uploads/u/abc.webp");
  });
});
