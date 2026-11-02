/**
 * 简历文件名的纯函数（P13 · 重命名 / 类型标签 / 预填草稿）。
 *
 * 与 Web 端 apps/web/app/api/resume-files/[id]/route.ts 的 normalizeRenameInput **同口径**：
 *  - 只允许改主干，**扩展名以原文件为准**（pdf/doc/docx），用户写别的合法扩展名会被原扩展覆盖；
 *  - 禁止路径分隔符（/ 与反斜杠），否则显示名可能被拼进 Content-Disposition 的文件名参数；
 *  - 控制字符压成空格、连续空白折叠、去首尾空白与首尾点；
 *  - 最终文件名（含扩展名）≤ 80 字符 —— 服务端同样在 80 处拒绝（不是静默截断）。
 *
 * 为什么单独成文件：组件里只留 UI 状态，规范化逻辑可单测（非法字符/扩展名保留/超长）。
 */

export const RESUME_FILE_NAME_MAX = 80;
export const RESUME_EXTENSIONS = ["pdf", "doc", "docx"] as const;
export type ResumeExt = (typeof RESUME_EXTENSIONS)[number];

/** 扩展名 → 上传/预览时用的 MIME（预览兜底与上传补扩展名共用一张表） */
export const RESUME_MIME_BY_EXT: Record<ResumeExt, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function isResumeExt(value: string): value is ResumeExt {
  return (RESUME_EXTENSIONS as readonly string[]).includes(value);
}

/** 从文件名取扩展名（只认 pdf/doc/docx），取不到返回 null */
export function resumeExtOfName(fileName: string): ResumeExt | null {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(String(fileName ?? "").trim());
  const ext = match ? match[1].toLowerCase() : "";
  return isResumeExt(ext) ? ext : null;
}

/** MIME → 扩展名（安卓各家文件提供方常给不出带扩展名的文件名，用它兜底） */
export function resumeExtOfMime(mime: string | null | undefined): ResumeExt | null {
  const value = String(mime ?? "").toLowerCase();
  if (value === "application/pdf") return "pdf";
  if (value === "application/msword") return "doc";
  if (value.includes("wordprocessingml")) return "docx";
  return null;
}

/** 去掉扩展名后的主干（没有可识别扩展名时返回原串） */
export function resumeFileNameBody(fileName: string): string {
  const name = String(fileName ?? "").trim();
  const ext = resumeExtOfName(name);
  if (!ext) return name;
  return name.slice(0, name.length - ext.length - 1);
}

/** Word 文件（.doc/.docx）——预览走系统/在线兜底，需要额外提示 */
export function isWordResume(fileName: string): boolean {
  const ext = resumeExtOfName(fileName);
  return ext === "doc" || ext === "docx";
}

/** 列表里展示的类型标签 */
export function resumeKindLabel(fileName: string): string {
  const ext = resumeExtOfName(fileName);
  if (!ext) return "文件";
  return ext === "pdf" ? "PDF" : "Word";
}

export type ResumeRenameValidation =
  | { ok: true; fileName: string }
  | { ok: false; error: string };

/**
 * 把弹层里输入的草稿规范成最终显示名。
 *
 * @param input 用户输入（可以只写主干，也可以把扩展名一起写进来）
 * @param originalFileName 当前文件名（决定保留哪个扩展名；取不到扩展名时不追加）
 */
export function normalizeResumeFileName(input: string, originalFileName: string): ResumeRenameValidation {
  const cleaned = String(input ?? "")
    .replace(/[\r\n\t\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim();
  if (/[\\/]/.test(cleaned)) return { ok: false, error: "文件名不能包含 / 或 \\" };
  if (!cleaned) return { ok: false, error: "文件名不能为空" };

  const storedExt = resumeExtOfName(originalFileName);
  if (!storedExt) {
    if (cleaned.length > RESUME_FILE_NAME_MAX) {
      return { ok: false, error: "文件名最多 " + RESUME_FILE_NAME_MAX + " 个字符" };
    }
    return { ok: true, fileName: cleaned };
  }

  const typed = /^(.*)\.([A-Za-z0-9]{1,8})$/.exec(cleaned);
  const typedExt = typed ? typed[2].toLowerCase() : "";
  // 用户写的扩展名与原扩展一致（忽略大小写）→ 原样保留用户写法
  if (typed && typedExt === storedExt) {
    if (cleaned.length > RESUME_FILE_NAME_MAX) {
      return { ok: false, error: "文件名最多 " + RESUME_FILE_NAME_MAX + " 个字符" };
    }
    return { ok: true, fileName: cleaned };
  }
  // 其余情况：只有确实是 pdf/doc/docx 的“写错扩展名”才丢掉，其余点号（如 v2.0）属于主干
  const typedAllowed = isResumeExt(typedExt);
  const base = (typedAllowed && typed ? typed[1] : cleaned).replace(/^\.+|\.+$/g, "").trim();
  if (!base) return { ok: false, error: "文件名不能为空" };
  const fileName = base + "." + storedExt;
  if (fileName.length > RESUME_FILE_NAME_MAX) {
    return { ok: false, error: "文件名最多 " + RESUME_FILE_NAME_MAX + " 个字符" };
  }
  return { ok: true, fileName };
}

/** 弹层预填：只填主干（扩展名作为右侧固定后缀展示），用户不会误删扩展名 */
export function resumeRenameDraft(fileName: string): string {
  return resumeFileNameBody(fileName).trim();
}

/** 输入框 maxLength：留出 “.” + 扩展名的长度，保证提交后总长不超上限 */
export function resumeRenameMaxLength(originalFileName: string): number {
  const ext = resumeExtOfName(originalFileName);
  return ext ? RESUME_FILE_NAME_MAX - ext.length - 1 : RESUME_FILE_NAME_MAX;
}

/** 列表第二行：类型 · 大小 · 上传日期（纯函数便于单测） */
export function resumeFileMetaText(input: {
  fileName: string;
  bytes: number;
  createdAt: string;
}): string {
  const size = formatResumeBytes(input.bytes);
  const date = String(input.createdAt ?? "").slice(0, 10);
  return [resumeKindLabel(input.fileName), size, date].filter((part) => part.length > 0).join(" · ");
}

/** 字节 → 可读大小（KB 取整、MB 一位小数） */
export function formatResumeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
