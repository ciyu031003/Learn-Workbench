/**
 * 408 题干 / 答案的纯文本清洗（v2.6.10 渲染审计）。
 * 独立成纯模块，方便 vitest 直接覆盖，不牵扯 expo-constants。
 */

/** 题干清洗：图片交给 imageRefs 渲染，正文只保留说明文字 */
export function cleanExamStem(stem: string): string {
  return String(stem ?? "")
    .replace(/^[ \t]*!\[[^\]]*\]\([^)]+\)[ \t]*\r?\n?/gm, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    // 非惊叹号的 [题X图 …](/content-images/…) 链接与 imageRefs 重复（快照已核实 38/38 覆盖），
    // 图片统一走 imageRefs 渲染，文本里只留说明文字
    .replace(/\[([^\]\n]*)\]\(\/content-images\/[^)\s]+\)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 答案清洗：去掉开头的「答案：A / **答案：** / 【答案】」标签。
 *
 * 之前只匹配裸「答案：」+ 单个大写字母，导致：
 * - 「**答案：**」的星号原样露出，和下方答案字母重复；
 * - 多选题答案「答案：AB」只去掉 A，正文残留 B。
 */
export function cleanAnswerText(text: string): string {
  return String(text ?? "")
    .replace(
      /^\s*(?:\*\*)?\s*(?:【答案】|答案)\s*[:：]?\s*(?:\*\*)?\s*(?:(?:[A-Z]{1,4})(?=\s|$|[。，,；;、*])(?:\*\*)?)?\s*/,
      "",
    )
    // 「### 【答案】」这类标题形式的标签也要去掉，答案卡已经显示了「参考答案」
    .replace(/^#{1,6}\s*(?:【答案】|答案)\s*[:：]?\s*(?:\*\*)?\s*/, "")
    // 答案配图由 answerImageRefs 统一渲染，正文里的 markdown 图片必须去掉，
    // 否则会把 ![ ... ](/content-images/...) 原样露出来（2026-11 全量审计 14 题命中）。
    .replace(/^[ \t]*!\[[^\]]*\]\([^)]+\)[ \t]*\r?\n?/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
