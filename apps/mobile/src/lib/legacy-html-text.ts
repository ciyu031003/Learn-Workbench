import type { LearningTrack } from "@learn-workbench/content/types";

/**
 * 历史抓取残留的块级 HTML 清洗（题型：runoob 题库里的 `<p>…</p>` 段落）。
 *
 * 为什么不能无脑 strip 所有标签：题库里本来就有「选择所有 <p> 元素的 CSS 选择器」
 * 这种**以标签为题目内容**的题，也有选项就是 `<p>` / `<br>`。因此只在文本里
 * 出现**成对的 <p>…</p>** 时才按 HTML 块还原；孤立标签原样保留。
 *
 * 只用于展示层（题干 / 选项 / 解析），不参与判分（答案按选项 key 比对）。
 */

const P_PAIR = /<p\b[^>]*>[\s\S]*?<\/p>/i;

export function normalizeLegacyHtmlText(input: string): string {
  const text = String(input ?? "");
  if (!P_PAIR.test(text)) return text;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/?(p|div|ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<\/?(span|strong|em|b|i|a)\b[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 只清洗展示文本；保持题目 key / answer / tags 等判分字段不变。 */
export function sanitizeLearningTracks(tracks: LearningTrack[]): LearningTrack[] {
  return tracks.map((track) => ({
    ...track,
    questions: track.questions.map((question) => ({
      ...question,
      stem: normalizeLegacyHtmlText(question.stem),
      explanation: normalizeLegacyHtmlText(question.explanation),
      options: question.options.map((option) => ({
        ...option,
        text: normalizeLegacyHtmlText(option.text),
      })),
    })),
  }));
}
