const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]+\)/g;

/**
 * 非惊叹号的 `[题X图 …](/content-images/…)` 链接：原站把配图重复写进题干。
 * 已核实快照里全部 38 处此类链接在 `imageRefs` 都有对应图片（scripts 扫描 2026-10-24），
 * 渲染层会真正显示图片，因此文本里可以安全去掉链接语法、只留说明文字。
 */
const INLINE_IMAGE_LINK = /\[([^\]\n]*)\]\((\/content-images\/[^)\s]+)\)/g;

/** 408 原站正文可能把配图以内联 Markdown 重复写入题干；图片统一走 imageRefs 渲染。 */
export function cleanExamStem(stem: string): string {
  return stem
    .replace(MARKDOWN_IMAGE, "")
    .replace(INLINE_IMAGE_LINK, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanAnswerText(text: string): string {
  return text.replace(/^\s*答案\s*[:：]\s*[A-Z]?\s*/i, "").trim();
}
