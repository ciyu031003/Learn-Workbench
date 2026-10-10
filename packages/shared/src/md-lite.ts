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
