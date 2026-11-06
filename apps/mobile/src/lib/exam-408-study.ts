import type { InlineToken } from "@learn-workbench/shared/md-lite";

/**
 * 408 精读（cs408.cloud 镜像）数据层：远程契约 + Markdown 转结构块纯函数（v1.55）。
 *
 * 为什么另写一个 Markdown 解析而不是复用 md-lite：cs408 正文的方言更重 ——
 * 有表格、独立成行的 SVG/PNG 插图、block 公式（$$…$$）、行内公式（$…$）、
 * 大段引用块与 4~6 级标题，且正文里有 800+ 张图与 1184 行引用，md-lite 覆盖不到。
 * 这里仍然只产出结构块，由 RN 原生节点渲染，不注入任何 HTML（零 XSS 面）。
 *
 * 纯函数全部与网络/环境无关，便于单测：解析、归一化、目录提取、内联切分。
 */

/* ------------------------------------------------------------------ */
/* 远程契约                                                            */
/* ------------------------------------------------------------------ */

/** 科目 key 与 cs408 快照一致（scripts/cs408-study/import.mjs 的 SUBJECT_MAP）。 */
export const EXAM_408_STUDY_SUBJECTS = [
  { key: "data-structure", title: "数据结构" },
  { key: "computer-organization", title: "计算机组成原理" },
  { key: "operating-system", title: "操作系统" },
  { key: "computer-network", title: "计算机网络" },
] as const;

export type Exam408StudySubjectKey = (typeof EXAM_408_STUDY_SUBJECTS)[number]["key"];

export interface Exam408StudyArticleSummary {
  key: string;
  title: string;
  subjectKey: string;
  chapter: string;
  chapterOrder: number;
  slug: string;
  /** must / common / rare / none（迁移 085 的约束） */
  importance: string;
  /** 该主题在真题里被考到的次数（0 表示统计里没有命中） */
  examFrequency: number;
}

export interface Exam408StudyArticle extends Exam408StudyArticleSummary {
  contentMd: string;
  sourceUrl: string | null;
}

export interface Exam408StudyLink {
  slug: string;
  title: string;
  chapter?: string;
}

export interface Exam408StudyDetail {
  article: Exam408StudyArticle;
  prev: Exam408StudyLink | null;
  next: Exam408StudyLink | null;
  /**
   * 服务端 blocks（?format=svg 模式）：带 segments（行内公式段）与 math.svg。
   * 旧接口/离线时为空数组，阅读页回退到本地 parseStudyMarkdown(contentMd)。
   */
  blocks: StudyBlock[];
}

export interface Exam408StudyChapter {
  chapter: string;
  chapterOrder: number;
  articles: Exam408StudyArticleSummary[];
}

export interface Exam408StudyCatalog {
  subjectKey: string;
  chapters: Exam408StudyChapter[];
  total: number;
}

/* ------------------------------------------------------------------ */
/* Markdown 结构块                                                      */
/* ------------------------------------------------------------------ */

export type StudyInline =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "code"; value: string }
  | { type: "math"; value: string };

/**
 * 服务端预渲染的公式段（v1.55 / P7）。
 *
 * App 端没有数学字体，接口带 ?format=svg 时会把一段文本按 $...$ 切成 text/math 段，
 * math 段里是服务端 TeX→SVG 的结果（可能为 null，渲染方回退等宽 LaTeX）。
 *
 * v2.2：服务端只负责切公式，text 段里仍可能残留 **粗体** / `代码` 标记。
 * 归一化阶段会把 text 段再按行内标记切一次，因此段类型扩展出 strong/code；
 * 渲染方（markdown-article 的 SegmentRow）与 InlineText 共用同一套 token 语义。
 */
export type StudyTextSegment = { type: "text"; text: string };
export type StudyStrongSegment = { type: "strong"; value: string };
export type StudyCodeSegment = { type: "code"; value: string };
export type StudyMathSegment = { type: "math"; tex: string; svg: string | null };
export type StudySegment =
  | StudyTextSegment
  | StudyStrongSegment
  | StudyCodeSegment
  | StudyMathSegment;

/** 段/行内 token 扁平化成纯文本（表格列宽估算与目录去标记共用） */
export function studyInlinePlain(tokens: StudyInline[] | undefined): string {
  if (!tokens || tokens.length === 0) return "";
  return tokens.map((token) => token.value).join("");
}

export function studySegmentsPlain(segments: StudySegment[] | undefined): string {
  if (!segments || segments.length === 0) return "";
  return segments
    .map((segment) => (segment.type === "math" ? segment.tex : segment.type === "text" ? segment.text : segment.value))
    .join("");
}

/** 估算显示宽度：CJK/全角按 2 个字符宽，ASCII 按 1 */
function studyDisplayUnits(text: string): number {
  let units = 0;
  for (const char of text) {
    units += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff00-\uff60\uffe0-\uffe6]/.test(char) ? 2 : 1;
  }
  return units;
}

/**
 * 408 精读表格的列宽（v2.2.2）。
 *
 * 为什么需要：每行是独立的 flex 行，单元格宽度按内容自适应时表头与数据行的列宽不一致，
 * 「描述」「示例」会错位、文字跑到别的列下面。这里按列取全表最长内容估算宽度，
 * 表头与所有数据行共用同一组宽度；超长内容在固定宽度内换行。
 */
export function studyTableColumnWidths(header: string[], rows: string[][], columnCount: number): number[] {
  const count = Math.max(1, columnCount);
  const widths: number[] = [];
  for (let column = 0; column < count; column += 1) {
    const cells = [header[column] ?? "", ...rows.map((row) => row[column] ?? "")];
    const units = Math.max(6, ...cells.map((cell) => studyDisplayUnits(cell)));
    // 6.3 近似一个半角字符在 caption 字号下的像素宽，+30 覆盖左右 padding 与边框
    widths.push(Math.min(236, Math.max(92, Math.round(units * 6.3 + 30))));
  }
  return widths;
}

export interface StudyListItem {
  inlines: StudyInline[];
  /** 缩进层级（0 = 顶层，1 = 二级，最多 2） */
  depth: number;
  /** 服务端切好的 text/math 段（有值时优先于 inlines 渲染） */
  segments?: StudySegment[];
}

export type StudyBlock =
  | { type: "heading"; level: number; text: string; id: string }
  | { type: "paragraph"; inlines: StudyInline[]; segments?: StudySegment[] }
  | { type: "list"; ordered: boolean; items: StudyListItem[] }
  | {
      type: "table";
      header: StudyInline[][];
      rows: StudyInline[][][];
      headerSegments?: StudySegment[][];
      rowSegments?: StudySegment[][][];
    }
  | { type: "code"; lang: string; code: string }
  | { type: "quote"; lines: StudyInline[][]; lineSegments?: StudySegment[][] }
  | { type: "image"; src: string; alt: string }
  | { type: "math"; tex: string; svg?: string | null }
  | { type: "embed"; src: string; title: string }
  | { type: "divider" };

/** 目录项：标题锚点（正文里的 2~3 级标题） */
export interface StudyTocItem {
  id: string;
  level: number;
  text: string;
}

const FENCE_OPEN = /^\s*(`{3,}|~{3,})\s*(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const DIVIDER = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const UL_ITEM = /^(\s*)[-*+]\s+(.*)$/;
const OL_ITEM = /^(\s*)\d+[.)]\s+(.*)$/;
const QUOTE_LINE = /^\s*>\s?(.*)$/;
const STANDALONE_IMAGE = /^\s*!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)\s*$/;
const HTML_IMAGE_SRC = /<img\b[^>]*?\bsrc=["']([^"']+)["']/i;
const HTML_IMAGE_ALT = /<img\b[^>]*?\balt=["']([^"']*)["']/i;
const HTML_IFRAME = /<iframe\b[^>]*?\bsrc=["']([^"']*)["'][^>]*>/i;
const BLOCK_MATH_ONE_LINE = /^\s*\$\$(.+?)\$\$\s*$/;
const BLOCK_MATH_OPEN = /^\s*\$\$\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

/** 行内公式（\\(…\\) / $…$）的最大长度：cs408 公式普遍较长，放宽到 300 字符。 */
const MAX_INLINE_MATH = 300;

function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.indexOf("|", 1) >= 0;
}

function tableCells(line: string): string[] {
  const t = line.trim();
  const body = t.startsWith("|") ? t.slice(1) : t;
  const trimmed = body.endsWith("|") ? body.slice(0, -1) : body;
  const ESC = String.fromCharCode(0);
  return trimmed
    .replace(/\\\|/g, ESC)
    .split("|")
    .map((cell) => cell.trim().split(ESC).join("|"));
}

/**
 * 行内 HTML 清理。cs408 正文里大量尖括号记号（如 reg、i,j、Key,Value、stdlib.h 这类
 * 数学/代码写法）不是 HTML，不能当标签删；这里只处理白名单里的真标签：
 * br 变换行、img 丢弃（插图在块级已单独处理）、其余白名单标签去壳留文字。
 */
export function sanitizeStudyInlineHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<\/?(?:a|strong|em|code|sup|sub|span|div|p|figure|figcaption|html|body)\b[^>]*>/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** 从服务端 math 段队列里取一个 svg：优先 tex 完全相同的，取不到就按顺序兜底。 */
function takeMathSegment(tex: string, queue: StudyMathSegment[]): StudyMathSegment {
  const wanted = tex.trim();
  const exact = queue.findIndex((item) => item.tex.trim() === wanted);
  if (exact >= 0) return queue.splice(exact, 1)[0];
  const fallback = queue.shift();
  return { type: "math", tex, svg: fallback?.svg ?? null };
}

/** 从 start 开始连续星号的数量（用于容错 Markdown 的 *** / **** 写法）。 */
function starRunLength(source: string, start: number): number {
  let end = start;
  while (source[end] === "*") end += 1;
  return end - start;
}

/** 找下一个长度 ≥2 的星号串（加粗闭合标记）；找不到返回 -1。 */
function findStarRun(source: string, from: number): number {
  let cursor = from;
  while (cursor < source.length) {
    if (source[cursor] === "*") {
      const run = starRunLength(source, cursor);
      if (run >= 2) return cursor;
      cursor += run;
      continue;
    }
    cursor += 1;
  }
  return -1;
}

/**
 * 行内扫描（v2.2 的核心纯函数）：把一段文本切成 text / strong / code / math 段。
 *
 * 为什么以「整段文本」为输入，而不是逐条解析服务端 segments：
 * cs408 正文里 `**…$O(n)$…**`（粗体跨公式）、`**…`code`…**`（粗体套行内代码）非常常见。
 * 服务端只按 $…$ 切公式，粗体标记会被切到两个 text 段里；逐段解析必然漏出 `**`。
 * 这里先在整段文本上配对粗体，再把粗体内部摊平成同级 code/math 段（粗体只包文字），
 * 因此跨公式、套代码的粗体都能正确成型。mathQueue 提供 svg（匹配不到时 svg=null，回退等宽 LaTeX）。
 */
function scanStudySegments(
  source: string,
  mathQueue: StudyMathSegment[],
  bold: boolean,
): StudySegment[] {
  const segments: StudySegment[] = [];
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    segments.push(bold ? { type: "strong", value: buffer } : { type: "text", text: buffer });
    buffer = "";
  };
  let index = 0;
  while (index < source.length) {
    const char = source[index];

    // 行内代码：粗体内部也认（摊平成 code 段，粗体只包住两侧文字）
    if (char === "`") {
      const end = source.indexOf("`", index + 1);
      if (end > index + 1) {
        const value = source.slice(index + 1, end);
        if (!value.includes("\n")) {
          flush();
          segments.push({ type: "code", value });
          index = end + 1;
          continue;
        }
      }
    }

    // 粗体：只在顶层配对；内部允许 $…$ 与反引号（但不支持嵌套粗体）。
    // 按「星号串」而不是固定 "**" 配对：***粗斜*** / ****粗体**** 这类原文写法
    // 会把多余的星号留在正文里（实测 cs408 有 `****最小物理单位****`），
    // 连续 3 个以上且无配对的星号串直接丢弃（代码/math 内部不经过这里，密码掩码不受影响）。
    if (!bold && char === "*") {
      const openRun = starRunLength(source, index);
      if (openRun >= 2) {
        const close = findStarRun(source, index + openRun);
        if (close >= index + openRun) {
          flush();
          segments.push(...scanStudySegments(source.slice(index + openRun, close), mathQueue, true));
          index = close + starRunLength(source, close);
          continue;
        }
        if (openRun >= 3) {
          index += openRun;
          continue;
        }
      }
    }

    // LaTeX 行内定界符 \\(…\\)
    if (char === "\\" && source[index + 1] === "(") {
      const end = source.indexOf("\\)", index + 2);
      const tex = end > index + 2 ? source.slice(index + 2, end).trim() : "";
      if (tex && tex.length <= MAX_INLINE_MATH && !tex.includes("\n")) {
        flush();
        segments.push(takeMathSegment(tex, mathQueue));
        index = end + 2;
        continue;
      }
    }

    // $…$：纯金额/纯数字不当公式（如 $5），其余按公式渲染。
    // 纯数字整段按字面量跳过（而不是只吃掉第一个 $）：否则后面所有 $ 会错位配对，
    // 数学段会把 ** 标记一起吞掉（实测 `$1,1,0,1$` 触发了整段粗体失效）。
    if (char === "$") {
      const end = source.indexOf("$", index + 1);
      if (end > index + 1) {
        const inner = source.slice(index + 1, end);
        if (inner.length <= MAX_INLINE_MATH && !inner.includes("\n")) {
          if (/^[\d.,]+$/.test(inner)) {
            // 金额/纯数字：保留内部文本、丢掉 $ 定界符（不会出现字面量 $）
            buffer += inner;
            index = end + 1;
            continue;
          }
          flush();
          segments.push(takeMathSegment(inner.trim(), mathQueue));
          index = end + 1;
          continue;
        }
      }
    }

    buffer += char;
    index += 1;
  }
  flush();
  return segments;
}

/**
 * 把一段文本切成渲染段（text / strong / code / math）。纯函数，供归一化与单测直接使用；
 * math 传入服务端预渲染的公式段时按 tex 挂回 svg。
 */
export function parseStudySegments(text: string, math: StudyMathSegment[] = []): StudySegment[] {
  const source = String(text ?? "");
  if (!source) return [];
  return scanStudySegments(source, [...math], false);
}

/** 把一段文本切成行内 token（代码/加粗/公式/纯文本） */
export function parseStudyInline(text: string): StudyInline[] {
  const source = sanitizeStudyInlineHtml(String(text ?? ""));
  if (!source) return [];
  const tokens = scanStudySegments(source, [], false).map((segment): StudyInline => {
    if (segment.type === "text") return { type: "text", value: segment.text };
    if (segment.type === "math") return { type: "math", value: segment.tex };
    return segment;
  });
  return tokens.length > 0 ? tokens : [{ type: "text", value: source }];
}

/** 该行是否开启一个新块（段落累积时用于判断断点） */
function startsStudyBlock(line: string, next: string | undefined): boolean {
  const t = line.trim();
  if (!t) return true;
  if (FENCE_OPEN.test(line)) return true;
  if (HEADING.test(line)) return true;
  if (DIVIDER.test(line)) return true;
  if (BLOCK_MATH_ONE_LINE.test(line) || BLOCK_MATH_OPEN.test(line)) return true;
  if (QUOTE_LINE.test(line)) return true;
  if (UL_ITEM.test(line) || OL_ITEM.test(line)) return true;
  if (STANDALONE_IMAGE.test(line)) return true;
  if (/<iframe\b/i.test(line)) return true;
  if (isTableLine(line) && next !== undefined && TABLE_SEPARATOR.test(next)) return true;
  return false;
}

/**
 * cs408 正文转结构块。
 *
 * 支持：ATX 标题（1~6 级）、围栏代码块、独立成行的图片（Markdown 与 img 标签两种写法）、
 * 独立公式（单行或块状）、表格（含转义竖线）、引用块、有序/无序列表（含二级缩进）、
 * 分隔线、iframe 交互图谱（降级为提示块）、普通段落。
 *
 * 兼容取舍：段落内的手工换行按空格合并（与浏览器渲染一致）；
 * 未知的尖括号记号（数学记号）原样保留，只剥白名单 HTML 标签。
 */
export function parseStudyMarkdown(markdown: string): StudyBlock[] {
  const text = String(markdown ?? "");
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = withoutBom.replace(/\r\n?/g, "\n").split("\n");
  const blocks: StudyBlock[] = [];
  let headingSeq = 0;
  let index = 0;

  while (index < lines.length) {
    const line = (lines[index] ?? "").replace(/\t/g, "  ");
    const next = lines[index + 1];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    // 围栏代码块
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const marker = fence[1];
      const lang = (fence[2] ?? "").trim();
      const close = new RegExp("^\\s*" + marker[0] + "{3,}\\s*$");
      const body: string[] = [];
      index += 1;
      while (index < lines.length) {
        const current = lines[index] ?? "";
        if (close.test(current)) break;
        body.push(current);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", lang, code: body.join("\n").replace(/\n+$/, "") });
      continue;
    }

    // 独立公式
    const oneLineMath = BLOCK_MATH_ONE_LINE.exec(line);
    if (oneLineMath) {
      blocks.push({ type: "math", tex: oneLineMath[1].trim() });
      index += 1;
      continue;
    }
    if (BLOCK_MATH_OPEN.test(line)) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*\$\$\s*$/.test(lines[index] ?? "")) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      const tex = body.join(" ").trim();
      if (tex) blocks.push({ type: "math", tex });
      continue;
    }

    // iframe 交互图谱：App 内无法运行，给一个提示块（保留来源链接）
    if (/<iframe\b/i.test(line)) {
      const iframe = HTML_IFRAME.exec(line);
      const title = /title=["']([^"']*)["']/i.exec(line)?.[1] ?? "";
      const src = iframe?.[1] ?? "";
      index += 1;
      // 单行 iframe（开闭同排）与多行 iframe 都要正确跨过
      if (!/<\/iframe>/i.test(line)) {
        while (index < lines.length && !/<\/iframe>/i.test(lines[index] ?? "")) index += 1;
        index += 1;
      }
      if (src) blocks.push({ type: "embed", src, title });
      continue;
    }

    // 独立图片（Markdown 语法）
    const image = STANDALONE_IMAGE.exec(line);
    if (image) {
      blocks.push({ type: "image", alt: image[1] ?? "", src: image[2] ?? "" });
      index += 1;
      continue;
    }
    // 独立图片（HTML img 语法：src 与 alt 顺序不定，分别匹配）
    if (line.trim().startsWith("<img")) {
      const src = HTML_IMAGE_SRC.exec(line)?.[1] ?? "";
      const alt = HTML_IMAGE_ALT.exec(line)?.[1] ?? "";
      if (src) blocks.push({ type: "image", alt, src });
      index += 1;
      continue;
    }

    // 标题
    const heading = HEADING.exec(line);
    if (heading) {
      headingSeq += 1;
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: sanitizeStudyInlineHtml(heading[2].replace(/\s+#+\s*$/, "")),
        id: "study-h-" + headingSeq,
      });
      index += 1;
      continue;
    }

    // 分隔线
    if (DIVIDER.test(line)) {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    // 表格
    if (isTableLine(line) && next !== undefined && TABLE_SEPARATOR.test(next)) {
      const header = tableCells(line).map((cell) => parseStudyInline(cell));
      index += 2;
      const rows: StudyInline[][][] = [];
      while (index < lines.length && isTableLine(lines[index] ?? "")) {
        rows.push(tableCells(lines[index] ?? "").map((cell) => parseStudyInline(cell)));
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    // 引用块
    if (QUOTE_LINE.test(line)) {
      const quoteLines: StudyInline[][] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        const quoted = QUOTE_LINE.exec(current);
        if (!quoted) break;
        const quotedText = quoted[1].trim();
        if (quotedText) quoteLines.push(parseStudyInline(quotedText));
        index += 1;
      }
      if (quoteLines.length > 0) blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    // 列表
    const unordered = UL_ITEM.exec(line);
    const ordered = OL_ITEM.exec(line);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: StudyListItem[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        const u = UL_ITEM.exec(current);
        const o = OL_ITEM.exec(current);
        if (isOrdered ? !o : !u) break;
        const match = (isOrdered ? o : u)!;
        const indent = match[1].replace(/\t/g, "  ").length;
        const itemText = match[2].trim();
        if (itemText) {
          items.push({ inlines: parseStudyInline(itemText), depth: Math.min(2, Math.floor(indent / 2)) });
        }
        index += 1;
        // 列表项后面的续行（缩进段落）并入当前项
        while (
          index < lines.length &&
          (lines[index] ?? "").trim() !== "" &&
          !UL_ITEM.test(lines[index] ?? "") &&
          !OL_ITEM.test(lines[index] ?? "") &&
          startsStudyBlock(lines[index] ?? "", lines[index + 1]) === false
        ) {
          const extra = (lines[index] ?? "").trim();
          const previous = items[items.length - 1];
          if (previous) {
            items[items.length - 1] = {
              ...previous,
              inlines: [...previous.inlines, { type: "text", value: " " }, ...parseStudyInline(extra)],
            };
          }
          index += 1;
        }
      }
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }

    // 段落
    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (paragraph.length === 0 ? !current.trim() : startsStudyBlock(current, lines[index + 1])) break;
      paragraph.push(current.trim());
      index += 1;
    }
    const paragraphText = paragraph.join(" ").trim();
    if (paragraphText) {
      const inlines = parseStudyInline(paragraphText);
      if (inlines.length > 0) blocks.push({ type: "paragraph", inlines });
    }
  }

  return blocks;
}

/**
 * 去掉行内标记的纯文本（目录 / 无障碍朗读用）。
 * 标题里常见 `$O(n)$`、`\\(O(n)\\)` 与反引号，目录原样显示会是一串符号。
 */
export function studyPlainText(text: string): string {
  return String(text ?? "")
    .replace(/`([^`\n]*)`/g, "$1")
    .replace(/\*{3,}/g, "**")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\\\(([^\\\n]*?)\\\)/g, "$1")
    .replace(/\$([^$\n]+)\$/g, "$1")
    .trim();
}

/** 从结构块里提取目录（2~3 级标题；没有 2~3 级时回落到全部标题） */
export function buildStudyToc(blocks: StudyBlock[]): StudyTocItem[] {
  const all = blocks.filter((block): block is Extract<StudyBlock, { type: "heading" }> => block.type === "heading");
  const preferred = all.filter((block) => block.level === 2 || block.level === 3);
  const picked = preferred.length > 0 ? preferred : all;
  return picked.map((block) => ({ id: block.id, level: block.level, text: studyPlainText(block.text) }));
}

/** 插图类型：SVG 走 SvgXml，位图走 Image，未知按位图处理 */
export function studyImageKind(src: string): "svg" | "raster" {
  return /\.svg(?:[?#].*)?$/i.test(String(src ?? "")) ? "svg" : "raster";
}

/** 相对资源路径转绝对 URL（与 exam-408.ts 的 resolveExamAssetUrl 同口径，纯函数便于测试） */
export function resolveStudyAssetUrl(src: string, baseUrl: string): string {
  const ref = String(src ?? "").trim();
  if (!ref) return "";
  if (/^https?:\/\//i.test(ref)) return ref;
  if (/^data:/i.test(ref)) return ref;
  return baseUrl.replace(/\/+$/, "") + (ref.startsWith("/") ? ref : "/" + ref);
}

/* ------------------------------------------------------------------ */
/* 归一化 + 请求                                                       */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

/** 摘要归一化：老/新字段名都兜住（chapterTitle、exam_frequency 等） */
export function normalizeStudySummary(raw: unknown, fallbackSubject = ""): Exam408StudyArticleSummary {
  const item = asRecord(raw);
  return {
    key: asString(item.key ?? item.id),
    title: asString(item.title, "未命名主题"),
    subjectKey: asString(item.subjectKey ?? item.subject_key, fallbackSubject),
    chapter: asString(item.chapter ?? item.chapterTitle ?? item.chapter_title, ""),
    chapterOrder: asNumber(item.chapterOrder ?? item.chapter_order, 0),
    slug: asString(item.slug),
    importance: asString(item.importance, "common"),
    examFrequency: asNumber(item.examFrequency ?? item.exam_frequency, 0),
  };
}

/**
 * 408 hub 章节弹层的残留防御（P13，纯函数便于单测）。
 * 闪退/转场中断可能留下 visible=true 但内容快照已清空的弹层（整屏 Modal 挡住触摸，
 * 表现为「知识体系里点章节无反应」）——这种状态必须自动收敛回关闭。
 */
export function chapterSheetVisibleWithoutSnapshot(
  visible: boolean,
  hasSnapshot: boolean,
): boolean {
  return visible && !hasSnapshot;
}

/**
 * P13：从各种列表响应里收集「文章摘要」候选。
 *
 * 线上真实形状（2026-11-02 线上接口核对）：
 *   { mode:"subject", source, subject: { key,title,..., chapters:[{ chapter, chapterOrder,
 *     topics:[{ slug,title,chapter,chapterOrder,importance,examFrequency,... }] }] } }
 * 旧版/总览形状则是顶层 articles / items / topics、data.articles，或 subjects[].chapters[].topics。
 * 之前只认顶层数组 → App 知识精读一直空白（catalog.total=0）。
 */
function collectStudyArticleCandidates(payload: unknown): unknown[] {
  const record = asRecord(payload);
  const dataRecord = asRecord(record.data);
  const direct: unknown[] = [
    ...(Array.isArray(payload) ? payload : []),
    ...(Array.isArray(record.articles) ? record.articles : []),
    ...(Array.isArray(record.items) ? record.items : []),
    ...(Array.isArray(record.topics) ? record.topics : []),
    ...(Array.isArray(dataRecord.articles) ? dataRecord.articles : []),
  ];
  if (direct.length > 0) return direct;

  const trees: unknown[] = [];
  if (record.subject && typeof record.subject === "object") trees.push(record.subject);
  if (Array.isArray(record.subjects)) trees.push(...record.subjects);
  if (trees.length === 0) trees.push(record);

  const candidates: unknown[] = [];
  for (const tree of trees) {
    const treeRecord = asRecord(tree);
    if (Array.isArray(treeRecord.articles)) candidates.push(...treeRecord.articles);
    const chapters = Array.isArray(treeRecord.chapters) ? treeRecord.chapters : [];
    for (const chapter of chapters) {
      const chapterRecord = asRecord(chapter);
      const chapterName = asString(chapterRecord.chapter);
      const chapterOrder = asNumber(chapterRecord.chapterOrder, 0);
      // topic 自身没带 chapter 时用父级章节补齐，保证「按章分组」永远有归处
      const pushTopic = (topic: unknown) => {
        const topicRecord = asRecord(topic);
        candidates.push({
          ...topicRecord,
          chapter: asString(topicRecord.chapter) || chapterName,
          chapterOrder: asNumber(topicRecord.chapterOrder, chapterOrder),
        });
      };
      if (Array.isArray(chapterRecord.topics)) chapterRecord.topics.forEach(pushTopic);
      if (Array.isArray(chapterRecord.articles)) chapterRecord.articles.forEach(pushTopic);
    }
  }
  return candidates;
}

/** 列表接口可能返回数组、articles、items、topics、data.articles 或 subject/subjects 树，统一归一化并按章分组 */
export function normalizeStudyList(payload: unknown, subjectKey: string): Exam408StudyCatalog {
  const candidate = collectStudyArticleCandidates(payload);
  const articles = candidate
    .map((item) => normalizeStudySummary(item, subjectKey))
    .filter((item) => item.slug);

  const byChapter = new Map<string, Exam408StudyChapter>();
  for (const article of articles) {
    const chapter = article.chapter || "未分章";
    const entry = byChapter.get(chapter) ?? { chapter, chapterOrder: article.chapterOrder || 0, articles: [] };
    if (article.chapterOrder > 0) {
      entry.chapterOrder = entry.chapterOrder > 0 ? Math.min(entry.chapterOrder, article.chapterOrder) : article.chapterOrder;
    }
    entry.articles.push(article);
    byChapter.set(chapter, entry);
  }
  const chapters = [...byChapter.values()].sort(
    (a, b) => a.chapterOrder - b.chapterOrder || a.chapter.localeCompare(b.chapter, "zh-Hans-CN"),
  );
  return { subjectKey, chapters, total: articles.length };
}

/** 从服务端 segments 里收集 math 段（丢弃空 tex；svg 非字符串时置 null）。 */
function collectStudyMathSegments(value: unknown): StudyMathSegment[] {
  if (!Array.isArray(value)) return [];
  const math: StudyMathSegment[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (asString(record.type) !== "math") continue;
    const tex = asString(record.tex);
    if (!tex) continue;
    const svg = typeof record.svg === "string" && record.svg.includes("<svg") ? record.svg : null;
    math.push({ type: "math", tex, svg });
  }
  return math;
}

/**
 * 行内段归一化（v2.2）：
 *
 * 服务端 segments 只有 text / math 两种，text 段里仍可能带 **粗体** 与 `代码` 标记
 * （?format=svg 只切公式）。之前直接把 text 段原样交给 SegmentRow，导致正文出现字面量
 * `**`、反引号。这里先把 segments 还原成一段完整文本（math 用 \\(tex\\) 表示），
 * 再走 scanStudySegments 统一切分：粗体跨公式、粗体套代码都能正确成型，
 * math 段按 tex 匹配挂回服务端 svg（匹配不到 svg=null，渲染方回退等宽 LaTeX）。
 */
export function normalizeStudySegments(value: unknown): StudySegment[] {
  if (!Array.isArray(value)) return [];
  let source = "";
  for (const item of value) {
    const record = asRecord(item);
    const type = asString(record.type);
    if (type === "text") {
      source += asString(record.text);
      continue;
    }
    if (type === "strong") {
      const strong = asString(record.value ?? record.text);
      if (strong) source += "**" + strong + "**";
      continue;
    }
    if (type === "code") {
      const code = asString(record.value ?? record.text);
      if (code) source += "`" + code + "`";
      continue;
    }
    if (type === "math") {
      const tex = asString(record.tex);
      if (tex) source += "\\(" + tex + "\\)";
    }
  }
  if (!source) return [];
  return scanStudySegments(source, collectStudyMathSegments(value), false);
}

/** 接口 blocks → App 结构块（服务端已切好 quotes/list/table 的 segments） */
export function normalizeApiStudyBlocks(value: unknown): StudyBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: StudyBlock[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const type = asString(record.type);
    if (type === "heading") {
      const text = asString(record.text).trim();
      if (!text) continue;
      const level = Math.min(6, Math.max(1, Math.round(asNumber(record.level, 2))));
      blocks.push({ type: "heading", level, text, id: asString(record.id) || "api-h-" + blocks.length });
      continue;
    }
    if (type === "paragraph") {
      const lines = Array.isArray(record.lines) ? record.lines.filter((line): line is string => typeof line === "string") : [];
      const text = lines.join(" ").trim();
      const segments = normalizeStudySegments(record.segments);
      if (!text && segments.length === 0) continue;
      blocks.push({ type: "paragraph", inlines: parseStudyInline(text), ...(segments.length > 0 ? { segments } : {}) });
      continue;
    }
    if (type === "list") {
      const items = Array.isArray(record.items) ? record.items : [];
      const mapped: StudyListItem[] = [];
      for (const rawItem of items) {
        const itemRecord = asRecord(rawItem);
        const text = asString(itemRecord.text).trim();
        const segments = normalizeStudySegments(itemRecord.segments);
        if (!text && segments.length === 0) continue;
        mapped.push({
          inlines: parseStudyInline(text),
          depth: Math.min(2, Math.max(0, Math.round(asNumber(itemRecord.depth, 0)))),
          ...(segments.length > 0 ? { segments } : {}),
        });
      }
      if (mapped.length > 0) blocks.push({ type: "list", ordered: Boolean(record.ordered), items: mapped });
      continue;
    }
    if (type === "table") {
      const header = Array.isArray(record.header) ? record.header.map((cell) => asString(cell)) : [];
      const rows = Array.isArray(record.rows)
        ? record.rows.map((row) => (Array.isArray(row) ? row.map((cell) => asString(cell)) : []))
        : [];
      if (header.length === 0 && rows.length === 0) continue;
      const headerSegments = Array.isArray(record.headerSegments)
        ? record.headerSegments.map((cell) => normalizeStudySegments(cell))
        : undefined;
      const rowSegments = Array.isArray(record.rowSegments)
        ? record.rowSegments.map((row) => (Array.isArray(row) ? row.map((cell) => normalizeStudySegments(cell)) : []))
        : undefined;
      blocks.push({
        type: "table",
        header: header.map((cell) => parseStudyInline(cell)),
        rows: rows.map((row) => row.map((cell) => parseStudyInline(cell))),
        ...(headerSegments ? { headerSegments } : {}),
        ...(rowSegments ? { rowSegments } : {}),
      });
      continue;
    }
    if (type === "quote") {
      const lines = Array.isArray(record.lines) ? record.lines.filter((line): line is string => typeof line === "string") : [];
      if (lines.length === 0) continue;
      /**
       * v2.2 修复：服务端 segments 是**整块引用**（lines.join(" ")）的切分结果，
       * 旧实现把它当成第 1 行的 segments（[normalizeStudySegments(...)]），
       * 结果第 1 行渲染了整段引用、后续行又各渲染一次（正文重复）。
       * 这里用同一份 math svg 队列按行切分：每行只拿自己的文字与公式，
       * 只有出现过公式时才挂 lineSegments（纯文本行继续走 InlineText，排版不变）。
       */
      const mathQueue = collectStudyMathSegments(record.segments);
      const lineSegments = lines.map((line) => scanStudySegments(line, mathQueue, false));
      const hasMath = lineSegments.some((segments) => segments.some((segment) => segment.type === "math"));
      blocks.push({ type: "quote", lines: lines.map((line) => parseStudyInline(line)), ...(hasMath ? { lineSegments } : {}) });
      continue;
    }
    if (type === "code") {
      blocks.push({ type: "code", lang: asString(record.lang), code: asString(record.code) });
      continue;
    }
    if (type === "image") {
      const src = asString(record.src);
      if (src) blocks.push({ type: "image", src, alt: asString(record.alt) });
      continue;
    }
    if (type === "math") {
      const tex = asString(record.tex);
      if (!tex) continue;
      const svg = typeof record.svg === "string" && record.svg.includes("<svg") ? record.svg : null;
      blocks.push({ type: "math", tex, ...(svg ? { svg } : {}) });
      continue;
    }
    if (type === "iframe") {
      const src = asString(record.src);
      if (src) blocks.push({ type: "embed", src, title: asString(record.title) });
      continue;
    }
    if (type === "divider") {
      blocks.push({ type: "divider" });
    }
  }
  return blocks;
}

/**
 * 渲染用的文本分块：RN 的 Text 不能包 SvgXml，所以带行内公式的段落必须拆成
 * flexWrap 的行内块；按 ~14 个字符切块给折行留出机会（中文在块间断行）。
 */
export function chunkInlineText(text: string, size = 14): string[] {
  const source = String(text ?? "");
  if (!source) return [];
  const limit = Math.max(1, Math.floor(size));
  const chunks: string[] = [];
  let current = "";
  for (const char of source) {
    current += char;
    if (current.length >= limit) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** 详情归一化：article 是必填，prev/next 缺省为 null */
export function normalizeStudyDetail(payload: unknown): Exam408StudyDetail {
  const record = asRecord(payload);
  const articleRaw = asRecord(record.article ?? record.topic ?? record);
  const base = normalizeStudySummary(articleRaw);
  const rawUrl = articleRaw.sourceUrl ?? articleRaw.source_url;
  const article: Exam408StudyArticle = {
    ...base,
    contentMd: asString(articleRaw.contentMd ?? articleRaw.content_md ?? articleRaw.content),
    sourceUrl: typeof rawUrl === "string" && rawUrl.trim() ? rawUrl : null,
  };
  const toLink = (value: unknown): Exam408StudyLink | null => {
    const item = asRecord(value);
    const slug = asString(item.slug);
    if (!slug) return null;
    return { slug, title: asString(item.title, "未命名主题"), chapter: asString(item.chapter) || undefined };
  };
  return { article, prev: toLink(record.prev), next: toLink(record.next), blocks: normalizeApiStudyBlocks(record.blocks) };
}

/** 重要度转中文标签（迁移 085：must/common/rare/none） */
export function exam408StudyImportanceLabel(importance: string): string {
  switch (importance) {
    case "must":
      return "必考";
    case "rare":
      return "冷门";
    case "none":
      return "未考";
    default:
      return "常考";
  }
}

/** 科目 key 转中文名（未知 key 原样返回） */
export function exam408StudySubjectTitle(subjectKey: string): string {
  return EXAM_408_STUDY_SUBJECTS.find((item) => item.key === subjectKey)?.title ?? subjectKey;
}

async function requestJson(path: string): Promise<unknown> {
  // 动态 import：纯函数单测只 import 本模块，不拉起 expo-constants / zustand
  const { getApiUrl } = await import("@/config");
  const base = getApiUrl().replace(/\/+$/, "");
  const response = await fetch(base + path);
  if (!response.ok) {
    let message = "请求失败（" + response.status + "）";
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // 保持默认文案
    }
    throw new Error(message);
  }
  return (await response.json()) as unknown;
}

/** 科目转章节与文章清单 */
export async function getExam408StudyCatalog(subjectKey: string): Promise<Exam408StudyCatalog> {
  const payload = await requestJson("/api/exam/408/study?subject=" + encodeURIComponent(subjectKey));
  return normalizeStudyList(payload, subjectKey);
}

/** 单篇正文与前后导航 */
export async function getExam408StudyArticle(slug: string): Promise<Exam408StudyDetail> {
  // format=svg：服务端把公式渲染成 SVG、并把行内 $...$ 切成 segments（App 直接按段渲染）
  const payload = await requestJson(
    "/api/exam/408/study?slug=" + encodeURIComponent(slug) + "&format=svg",
  );
  return normalizeStudyDetail(payload);
}

/** 与共享层行内 token 的类型对齐（语义一致：text/code/strong/math） */
export type StudyInlineToken = InlineToken;