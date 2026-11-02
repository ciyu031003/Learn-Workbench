import { describe, expect, it } from "vitest";
import {
  RESUME_FILE_NAME_MAX,
  formatResumeBytes,
  isWordResume,
  normalizeResumeFileName,
  resumeExtOfMime,
  resumeExtOfName,
  resumeFileMetaText,
  resumeFileNameBody,
  resumeKindLabel,
  resumeRenameDraft,
  resumeRenameMaxLength,
} from "./resume-files";

describe("扩展名识别", () => {
  it("只认 pdf/doc/docx（大小写不敏感），其它一律 null", () => {
    expect(resumeExtOfName("简历.pdf")).toBe("pdf");
    expect(resumeExtOfName("简历.DOCX")).toBe("docx");
    expect(resumeExtOfName("简历.doc")).toBe("doc");
    expect(resumeExtOfName("简历.txt")).toBeNull();
    expect(resumeExtOfName("简历")).toBeNull();
    expect(resumeExtOfName("简历 v2.0")).toBeNull();
    expect(resumeExtOfName("")).toBeNull();
  });

  it("mime → 扩展名（安卓拿不到带扩展名文件时的兜底）", () => {
    expect(resumeExtOfMime("application/pdf")).toBe("pdf");
    expect(resumeExtOfMime("application/msword")).toBe("doc");
    expect(resumeExtOfMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
    expect(resumeExtOfMime("text/plain")).toBeNull();
    expect(resumeExtOfMime(null)).toBeNull();
  });

  it("主干 / 类型标签 / Word 判断", () => {
    expect(resumeFileNameBody("社招-后端.pdf")).toBe("社招-后端");
    expect(resumeFileNameBody("没有扩展名")).toBe("没有扩展名");
    expect(resumeKindLabel("a.pdf")).toBe("PDF");
    expect(resumeKindLabel("a.docx")).toBe("Word");
    expect(resumeKindLabel("a.bin")).toBe("文件");
    expect(isWordResume("a.doc")).toBe(true);
    expect(isWordResume("a.pdf")).toBe(false);
  });
});

describe("normalizeResumeFileName（重命名规范化）", () => {
  it("保留原扩展名：不写扩展名时自动补上", () => {
    expect(normalizeResumeFileName("秋招-后端", "旧名.pdf")).toEqual({ ok: true, fileName: "秋招-后端.pdf" });
    expect(normalizeResumeFileName("社招", "旧名.docx")).toEqual({ ok: true, fileName: "社招.docx" });
  });

  it("带点但不是扩展名（v2.0）不会被误判，仍补原扩展", () => {
    expect(normalizeResumeFileName("后端-简历 v2.0", "x.pdf")).toEqual({ ok: true, fileName: "后端-简历 v2.0.pdf" });
  });

  it("用户写了原扩展（大小写不同）→ 保留用户写法", () => {
    expect(normalizeResumeFileName("社招-V2.PDF", "x.pdf")).toEqual({ ok: true, fileName: "社招-V2.PDF" });
  });

  it("用户写了别的合法扩展名 → 以原扩展为准（不允许改文件类型）", () => {
    expect(normalizeResumeFileName("秋招.docx", "x.pdf")).toEqual({ ok: true, fileName: "秋招.pdf" });
    expect(normalizeResumeFileName("秋招.pdf", "x.docx")).toEqual({ ok: true, fileName: "秋招.docx" });
  });

  it("禁止路径分隔符（/ 与反斜杠）", () => {
    const slash = normalizeResumeFileName("秋招/后端", "x.pdf");
    expect(slash.ok).toBe(false);
    if (!slash.ok) expect(slash.error).toContain("不能包含");
    const back = normalizeResumeFileName("秋招\\后端", "x.pdf");
    expect(back.ok).toBe(false);
  });

  it("空 / 纯空白 / 纯点 → 报错", () => {
    for (const input of ["", "   ", "\t\n", "...", " ... "]) {
      const result = normalizeResumeFileName(input, "x.pdf");
      expect(result.ok).toBe(false);
    }
  });

  it("控制字符压空格、连续空白折叠、去首尾点", () => {
    expect(normalizeResumeFileName("  秋招\r\n  后端.  ", "x.pdf")).toEqual({
      ok: true,
      fileName: "秋招 后端.pdf",
    });
  });

  it("长度上限 80（含扩展名）；超长报错而不是静默截断", () => {
    const exact = "a".repeat(RESUME_FILE_NAME_MAX - 4); // + ".pdf" = 80
    expect(normalizeResumeFileName(exact, "x.pdf")).toEqual({ ok: true, fileName: exact + ".pdf" });
    const tooLong = "a".repeat(RESUME_FILE_NAME_MAX - 3); // 81
    const result = normalizeResumeFileName(tooLong, "x.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(RESUME_FILE_NAME_MAX));
  });

  it("原文件没有可识别扩展名 → 不追加扩展名（也不改用户输入）", () => {
    expect(normalizeResumeFileName("说明文件", "noext")).toEqual({ ok: true, fileName: "说明文件" });
  });
});

describe("弹层预填与长度预算", () => {
  it("预填只给主干，扩展名作为固定后缀展示", () => {
    expect(resumeRenameDraft("社招-后端.pdf")).toBe("社招-后端");
    expect(resumeRenameDraft("简历")).toBe("简历");
  });

  it("输入框 maxLength 预留扩展名长度", () => {
    expect(resumeRenameMaxLength("a.pdf")).toBe(RESUME_FILE_NAME_MAX - 4);
    expect(resumeRenameMaxLength("a.docx")).toBe(RESUME_FILE_NAME_MAX - 5);
    expect(resumeRenameMaxLength("无扩展名")).toBe(RESUME_FILE_NAME_MAX);
  });
});

describe("列表元信息", () => {
  it("类型 · 大小 · 日期", () => {
    expect(resumeFileMetaText({ fileName: "a.pdf", bytes: 1536, createdAt: "2026-11-01T10:00:00.000Z" })).toBe(
      "PDF · 2 KB · 2026-11-01"
    );
    expect(resumeFileMetaText({ fileName: "b.docx", bytes: 0, createdAt: "" })).toBe("Word · —");
  });

  it("字节格式化边界", () => {
    expect(formatResumeBytes(0)).toBe("—");
    expect(formatResumeBytes(999)).toBe("999 B");
    expect(formatResumeBytes(1024)).toBe("1 KB");
    expect(formatResumeBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
