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

const FENCE = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;

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

    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const marker = fence[1];
      const lang = (fence[2] ?? "").trim();
      const body: string[] = [];
      index += 1;
      while (index < lines.length) {
        const next = lines[index] ?? "";
        if (new RegExp(`^\\s*${marker}\\s*$`).test(next)) break;
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

const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\$[^$\n]{1,40}\$)/g;

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
    else if (raw.startsWith("$")) {
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
