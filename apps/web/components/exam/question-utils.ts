const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]+\)/g;

/** 408 原站正文可能把配图以内联 Markdown 重复写入题干；图片统一走 imageRefs 渲染。 */
export function cleanExamStem(stem: string): string {
  return stem
    .replace(MARKDOWN_IMAGE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanAnswerText(text: string): string {
  return text.replace(/^\s*答案\s*[:：]\s*[A-Z]?\s*/i, "").trim();
}
