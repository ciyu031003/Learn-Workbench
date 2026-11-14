/**
 * 极简 Markdown 解析（只服务于 MD 导入的 content_topic_items 正文渲染）。
 *
 * 为什么不用第三方渲染器：零新增依赖约束 + 导入内容可能来自外部仓库，
 * 直接 `dangerouslySetInnerHTML` 会引入 XSS 面。这里只解析出**结构块**，
 * 由各端用原生节点渲染（Web: React 文本节点 / 移动端: RN Text），
 * 天然不执行任何 HTML/脚本。纯函数、无 I/O，Web 与移动端共享同一实现。
 *
 * 支持：ATX 标题、围栏代码块（``` / ~~~）、无序/有序列表、引用块、段落。
 * 行内只识别 `` `code` ``。
 */

export type MdBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "paragraph"; text: string };

const FENCE = /^\s*(```|~~~)\s*(.*?)\s*$/;
// 围栏闭合行预编译（评审 2026-10-31 P3）：此前在 while 循环里对每行 new RegExp（万行
// 代码块时纯浪费）；marker 只可能 ``` / ~~~，两个常量正好覆盖
const FENCE_CLOSE = { "```": /^\s*```\s*$/, "~~~": /^\s*~~~\s*$/ } as const;
const HEADING = /^(#{1,6})\s+(.*)$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;

/** 是否为合法围栏开行（``` 的 info string 按 CommonMark 不允许再含反引号，如 "```js x" 合法、"```a`b" 整行落段落） */
function matchFence(line: string): { marker: "```" | "~~~"; lang: string } | null {
  const fence = FENCE.exec(line);
  if (!fence) return null;
  const marker = fence[1] as "```" | "~~~";
  const info = fence[2] ?? "";
  if (marker === "```" && info.includes("`")) return null;
  return { marker, lang: info.trim() };
}

/** 把 Markdown 正文解析成结构块；空输入返回空数组 */
export function parseMarkdownLite(markdown: string): MdBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    const fence = matchFence(line);
    if (fence) {
      flush();
      const lang = fence.lang;
      const closeRe = FENCE_CLOSE[fence.marker];
      const body: string[] = [];
      index += 1;
      while (index < lines.length) {
        const next = lines[index] ?? "";
        if (closeRe.test(next)) break;
        body.push(next);
        index += 1;
      }
      blocks.push({ type: "code", lang, code: body.join("\n").replace(/\n+$/, "") });
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].replace(/\s+#+\s*$/, "").trim(),
      });
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      flush();
      blocks.push({ type: "quote", text: quote[1].trim() });
      continue;
    }

    const unordered = UL.exec(line);
    const ordered = OL.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(((unordered ?? ordered)?.[1] ?? "").trim());
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flush();
  return blocks;
}

/** 行内切成文本与代码片段（各端据此用原生节点渲染，不注入 HTML） */
export function splitInlineCode(text: string): Array<{ code: boolean; value: string }> {
  const parts: Array<{ code: boolean; value: string }> = [];
  for (const chunk of text.split(/(`[^`]*`)/g)) {
    if (!chunk) continue;
    if (chunk.length >= 2 && chunk.startsWith("`") && chunk.endsWith("`")) {
      parts.push({ code: true, value: chunk.slice(1, -1) });
    } else {
      parts.push({ code: false, value: chunk });
    }
  }
  return parts;
}

/**
 * 行内富文本切分（题库 / 知识点正文展示用）。
 *
 * 为什么需要：内容里偶发出现 Markdown 风格的行内标记（`**加粗**`、`` `代码` ``、`$公式$`），
 * 直接当纯文本渲染会把标记符号原样显示出来（`$abc$`、`**重点**`），看起来像"被符号糊住"。
 * 这里把它们切成 token，由各端用**原生节点**渲染（不注入 HTML，零 XSS 面）。
 *
 * 保守口径（宁可少认，不要误伤真实内容）：
 *   - `__name__` / `_x_` **不**当强调 —— Python dunder 与变量名必须原样显示；
 *   - `$...$` 必须有**成对的** `$` 且内部非空、不含空格开头结尾、长度 ≤ 40，避免把 shell 的 `$VAR` 误判成公式；
 *   - `**...**` 内部不能跨行、不能为空。
 */
export type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; value: string }
  | { type: "math"; value: string };

/**
 * 行内标记口径：
 *  - `` `代码` ``、`**加粗**`、`$公式$`；
 *  - `\(公式\)`（LaTeX 行内定界符）：408 真题答案里 150+ 处，纯文本渲染会露出反斜杠括号。
 *    定界符本身不会误伤自然语言，所以内部允许空格（`\( p \)` 是合法写法），只要求非空、单行、≤160 字符。
 *  - 单星 `*x*` **刻意不支持**：408 内容里单星几乎全是 C 指针（`*p`、`LinkNode *lchild`）与乘号，认了必误伤。
 */
const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\\\([^\\\n]{1,160}?\\\))|(\$[^$\n]{1,40}\$)/g;

function looksLikeMath(inner: string): boolean {
  if (!inner) return false;
  if (inner !== inner.trim()) return false;      // 首尾有空格 → 多半是自然语言里的两个 $
  if (/^[\d.,]+$/.test(inner)) return false;     // 纯数字/金额
  return true;
}

/** 把一行文本切成行内 token（无标记时返回单个 text token） */
export function parseInlineRich(text: string): InlineToken[] {
  const source = String(text ?? "");
  if (!source) return [];
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of source.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    const raw = match[0];
    let token: InlineToken | null = null;
    if (raw.startsWith("`")) token = { type: "code", value: raw.slice(1, -1) };
    else if (raw.startsWith("**")) token = { type: "strong", value: raw.slice(2, -2) };
    else if (raw.startsWith("\\(")) {
      const inner = raw.slice(2, -2).trim();
      if (inner) token = { type: "math", value: inner };
    } else if (raw.startsWith("$")) {
      const inner = raw.slice(1, -1);
      if (looksLikeMath(inner)) token = { type: "math", value: inner };
    }
    if (!token) continue;                        // 不认的 → 原样留在文本里
    if (index > last) tokens.push({ type: "text", value: source.slice(last, index) });
    tokens.push(token);
    last = index + raw.length;
  }
  if (last < source.length) tokens.push({ type: "text", value: source.slice(last) });
  return tokens.length > 0 ? tokens : [{ type: "text", value: source }];
}

/* ------------------------------------------------------------------ */
/* 题库块级解析（408 真题 / 面试题的题干与答案）                        */
/* ------------------------------------------------------------------ */

/**
 * 题库内容的结构块。
 *
 * 与 `parseMarkdownLite` 的关键差异：**段落保留原始行**（`lines`）而不是 join 成一句 ——
 * 题干里的手工换行（伪代码、`[ data | link ]` 结构图、①②③ 分步）是排版语义，
 * 标准 markdown 的"段落内换行合并"会把这些压成一团。
 */
export type QuestionBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "table"; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; lines: string[] };

const TABLE_SEPARATOR = /^:?-{2,}:?$/;

function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.indexOf("|", 1) >= 0;
}

/** `| a | b |` → ["a","b"]（首尾空段丢弃；行内仍是纯文本，交给 parseInlineRich） */
function tableCells(line: string): string[] {
  const t = line.trim();
  const body = t.startsWith("|") ? t.slice(1) : t;
  const body2 = body.endsWith("|") ? body.slice(0, -1) : body;
  // `\|` 是转义竖线（评审 2026-10-31 P3，此前含 \| 的单元格被错误切开）：先占位再还原
  const ESC = "\u0000";
  return body2
    .replace(/\\\|/g, ESC)
    .split("|")
    .map((cell) => cell.trim().split(ESC).join("\\|").replace(/<br\s*\/?>/gi, "\n"));
}

/**
 * 把题库文本解析成结构块；`<br>`（含 `<br/>`）在段落/列表/表格单元格内换成换行，
 * 代码块内保留原文 —— 数据里唯一的真 HTML 标签就是它，其余尖括号内容
 * （`<v0,v1>`、`<net1,16>`）是数学记号，必须原样保留。
 */
export function parseQuestionBlocks(text: string): QuestionBlock[] {
  const source = String(text ?? "");
  if (!source.trim()) return [];
  // `<br>` 不能在最前面统一换成换行：表格单元格里的 <br> 会把一行表格拆成多行，
  // 代码块里的 <br> 也可能本来就是要展示的代码。改为在各结构渲染前局部处理。
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const softBreak = (value: string) => value.replace(/<br\s*\/?>/gi, "\n");
  const blocks: QuestionBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    // 段落内的 <br> 还原成独立行（保持旧结构：lines 数组每项一行），
    // 表格单元格与代码块不经过这里，所以不会被拆散。
    const kept = paragraph
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => softBreak(line.trim()).split("\n"))
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (kept.length > 0) blocks.push({ type: "paragraph", lines: kept });
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      flush();
      continue;
    }

    const fence = matchFence(line);
    if (fence) {
      flush();
      const lang = fence.lang;
      const closeRe = FENCE_CLOSE[fence.marker];
      const body: string[] = [];
      index += 1;
      while (index < lines.length) {
        const next = lines[index] ?? "";
        if (closeRe.test(next)) break;
        body.push(next);
        index += 1;
      }
      blocks.push({ type: "code", lang, code: body.join("\n").replace(/\n+$/, "") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        // 标题里出现 <br> 时压成空格，避免标题被拆成多行
        text: softBreak(heading[2].replace(/\s+#+\s*$/, "").trim()).replace(/\n/g, " "),
      });
      continue;
    }

    if (isTableLine(line)) {
      flush();
      const rows: string[][] = [];
      while (index < lines.length && isTableLine(lines[index] ?? "")) {
        const cells = tableCells(lines[index] ?? "");
        // 分隔行（| --- | --- |）不进数据
        if (!cells.every((cell) => TABLE_SEPARATOR.test(cell))) rows.push(cells);
        index += 1;
      }
      index -= 1; // 外层 for 会再 +1
      if (rows.length > 0) blocks.push({ type: "table", rows });
      continue;
    }

    const unordered = UL.exec(line);
    const ordered = OL.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(softBreak(((unordered ?? ordered)?.[1] ?? "").trim()));
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flush();
  return blocks;
}
