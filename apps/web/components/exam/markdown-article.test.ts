import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// MarkdownArticle 会经由 lib/exam-408-map 间接引入 pg 连接池；测试只渲染结构块，不查库。
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
// 交互图谱 / iframe 演示是客户端重组件，与本用例（纯 Markdown 渲染）无关，替换成占位。
vi.mock("@/components/exam/knowledge-map", () => ({ KnowledgeMap: () => null }));
vi.mock("@/components/exam/interactive-embed", () => ({ InteractiveEmbed: () => null }));
// lucide-react 在 pnpm 下带了一份嵌套 react，直接渲染图标会触发 "Invalid hook call"；
// 这里只关心 Markdown 结构，图标用空组件占位。
vi.mock("lucide-react", () => ({ Info: () => null, MonitorPlay: () => null }));

import { MarkdownArticle } from "@/components/exam/markdown-article";
import { parseStudyMarkdown } from "@/lib/exam-408-study";

/**
 * v2.3 回归：408 精读的段落 / 列表 / 引用 / 表格单元格都走行内富文本。
 * 用真实形态的样本（**粗体**、`代码`、$公式$、\(公式\)、管道表格）验证：
 * 真表格结构保留，且渲染结果里不再出现 ** 与反引号。
 */
const SAMPLE = [
  "## 顺序表",
  "",
  "顺序表用 **连续内存** 保存元素，按位访问是 `O(1)`，插入平均移动 $n/2$ 个元素。",
  "",
  "- **优点**：随机访问 `O(1)`",
  String.raw`- 注意 \( n \) 与 length 的区别`,
  "",
  "> 提示：**复杂度 `O(n)` 是常数级**，别把 $n/2$ 与 $(n-1)/2$ 记混。",
  "",
  "| 操作 | 时间复杂度 |",
  "| --- | --- |",
  "| 按位查找 | `O(1)` |",
  "| 插入 | **O(n)** |",
].join("\n");

describe("MarkdownArticle 行内富文本渲染", () => {
  it("段落/列表/引用/表格单元格均按 token 渲染，无 ** 与反引号残留", () => {
    const { blocks } = parseStudyMarkdown(SAMPLE);
    const html = renderToStaticMarkup(createElement(MarkdownArticle, { blocks }));

    // 真表格（不是把 | 当普通文本）
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(html).toContain("按位查找");

    // 行内标记 → 原生节点；公式 → KaTeX
    expect(html).toContain("<strong");
    expect(html).toContain("<code");
    expect(html).toContain("katex");
    expect(html).toContain("连续内存");

    // 不允许任何字面量标记漏到页面上
    expect(html).not.toContain("**");
    expect(html).not.toContain("`");
    expect(html).not.toContain("$n/2$");
    expect(html).not.toContain(String.raw`\(`);
    expect(html).not.toContain("| 操作 |");
  });

  it("strong 内部嵌套的 code / math 递归渲染（粗体里不漏符号）", () => {
    const { blocks } = parseStudyMarkdown("**复杂度 `O(n)` 是常数级，平均 $n/2$**");
    const html = renderToStaticMarkup(createElement(MarkdownArticle, { blocks }));
    expect(html).toContain("<strong");
    expect(html).toContain("<code");
    expect(html).toContain("O(n)");
    expect(html).not.toContain("**");
    expect(html).not.toContain("`");
    expect(html).not.toContain("$");
  });
});
