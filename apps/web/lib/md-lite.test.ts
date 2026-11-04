import { describe, expect, it } from "vitest";
import { parseMarkdownLite, splitInlineCode } from "./md-lite";

describe("parseMarkdownLite", () => {
  it("parses headings, lists, quotes and paragraphs", () => {
    const blocks = parseMarkdownLite(
      ["# 一级标题", "正文第一行", "正文第二行", "", "- 甲", "- 乙", "", "> 提示", "", "1. 第一步"].join("\n")
    );
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "一级标题" },
      { type: "paragraph", text: "正文第一行 正文第二行" },
      { type: "list", ordered: false, items: ["甲", "乙"] },
      { type: "quote", text: "提示" },
      { type: "list", ordered: true, items: ["第一步"] },
    ]);
  });

  it("keeps fenced code verbatim and ignores '#' inside it", () => {
    const blocks = parseMarkdownLite(["```python", "print('# not a heading')", "# also code", "```"].join("\n"));
    expect(blocks).toEqual([
      { type: "code", lang: "python", code: "print('# not a heading')\n# also code" },
    ]);
  });

  it("returns no blocks for blank input", () => {
    expect(parseMarkdownLite("   \n\n")).toEqual([]);
  });

  it("never emits raw HTML blocks (no injection surface)", () => {
    const blocks = parseMarkdownLite("<script>alert(1)</script>");
    expect(blocks).toEqual([{ type: "paragraph", text: "<script>alert(1)</script>" }]);
  });
});

describe("splitInlineCode", () => {
  it("splits inline code from prose", () => {
    expect(splitInlineCode("用 `pip install` 安装")).toEqual([
      { code: false, value: "用 " },
      { code: true, value: "pip install" },
      { code: false, value: " 安装" },
    ]);
  });
});

/* ---------- 题库富文本（shared/md-lite 新增能力，v1.50） ---------- */

import { parseInlineRich, parseQuestionBlocks } from "@learn-workbench/shared/md-lite";

describe("parseInlineRich（题库行内标记）", () => {
  it("无标记文本 → 单个 text token", () => {
    expect(parseInlineRich("普通题干")).toEqual([{ type: "text", value: "普通题干" }]);
  });

  it("加粗 / 行内代码 / $公式$ 各自成 token", () => {
    expect(parseInlineRich("前 **重点** 后")).toEqual([
      { type: "text", value: "前 " },
      { type: "strong", value: "重点" },
      { type: "text", value: " 后" },
    ]);
    expect(parseInlineRich("X=$2^7$×29/32")).toEqual([
      { type: "text", value: "X=" },
      { type: "math", value: "2^7" },
      { type: "text", value: "×29/32" },
    ]);
  });

  it("LaTeX 行内定界符渲染为公式 token（内部允许空格）", () => {
    // String.raw：源码里写 \( 即字面反斜杠+括号，避免转义歧义
    expect(parseInlineRich(String.raw`设指针 \( p \) 与 \(count = 0\)`)).toEqual([
      { type: "text", value: "设指针 " },
      { type: "math", value: "p" },
      { type: "text", value: " 与 " },
      { type: "math", value: "count = 0" },
    ]);
  });

  it("单星不成斜体：C 指针与乘号必须原样保留（408 数据实测口径）", () => {
    const text = "LinkNode *lchild, *rchild 与 sizeof(int) * 4";
    expect(parseInlineRich(text)).toEqual([{ type: "text", value: text }]);
  });

  it("LaTeX 定界符内部为空 → 不认，原样保留", () => {
    expect(parseInlineRich(String.raw`空 \(\) 对`)).toEqual([
      { type: "text", value: String.raw`空 \(\) 对` },
    ]);
  });

  it("边界：纯数字金额、未闭合 $、跨行 ** 都按普通文本保留", () => {
    // 单个 $（未闭合）不能吞掉后文
    expect(parseInlineRich("金额 $100 元")).toEqual([{ type: "text", value: "金额 $100 元" }]);
    // 成对但内部纯数字：当金额而不是公式（沿用 shared 的保守口径）
    expect(parseInlineRich("$123$")).toEqual([{ type: "text", value: "$123$" }]);
    // ** 不跨行
    expect(parseInlineRich("**跨\n行**")).toEqual([{ type: "text", value: "**跨\n行**" }]);
    // Python dunder 不被误认成强调
    expect(parseInlineRich("__init__ 与 _x_ 原样")).toEqual([{ type: "text", value: "__init__ 与 _x_ 原样" }]);
  });
});

describe("parseQuestionBlocks（题库块级解析）", () => {
  it("段落保留原始行，不把换行合并成一句", () => {
    const blocks = parseQuestionBlocks("结点结构为\n\n[ data | link ]\n假设该链表只给出了头指针");
    expect(blocks).toEqual([
      { type: "paragraph", lines: ["结点结构为"] },
      { type: "paragraph", lines: ["[ data | link ]", "假设该链表只给出了头指针"] },
    ]);
  });

  it("管道表格 → table 块（分隔行丢弃，单元格 trim）", () => {
    const blocks = parseQuestionBlocks(
      ["| 时钟节拍 | 功能 | 有效控制信号 |", "|---|---|---|", "| C5 | MAR ← (R1) | R1out, MARin |"].join("\n")
    );
    expect(blocks).toEqual([
      {
        type: "table",
        rows: [
          ["时钟节拍", "功能", "有效控制信号"],
          ["C5", "MAR ← (R1)", "R1out, MARin"],
        ],
      },
    ]);
  });

  it("行内含 | 但不是表格行（不以 | 开头）→ 保持段落", () => {
    expect(parseQuestionBlocks("[ data | link ]")).toEqual([{ type: "paragraph", lines: ["[ data | link ]"] }]);
  });

  it("<br> 换行、标题与列表", () => {
    const blocks = parseQuestionBlocks("题干第一行<br>题干第二行\n\n## 解析\n\n- 步骤一\n- 步骤二");
    expect(blocks).toEqual([
      { type: "paragraph", lines: ["题干第一行", "题干第二行"] },
      { type: "heading", level: 2, text: "解析" },
      { type: "list", ordered: false, items: ["步骤一", "步骤二"] },
    ]);
  });

  it("围栏代码块原样保留（# 开头不当标题）", () => {
    const blocks = parseQuestionBlocks(["```c", "int main() {", "  // # not heading", "}", "```"].join("\n"));
    expect(blocks).toEqual([{ type: "code", lang: "c", code: "int main() {\n  // # not heading\n}" }]);
  });

  it("数学尖括号记号不被当成 HTML 清理", () => {
    expect(parseQuestionBlocks("图 G = <v0, v1, v2>")).toEqual([
      { type: "paragraph", lines: ["图 G = <v0, v1, v2>"] },
    ]);
  });

  it("空输入 → 空数组", () => {
    expect(parseQuestionBlocks("  \n\n")).toEqual([]);
  });
});

describe("md-lite 微修与性能（评审 2026-10-31 P3）", () => {
  it("围栏 info string 容许空格（```js extra），``` 的 info 里再含反引号则整行落段落", () => {
    const ok = parseMarkdownLite(["```js extra", "let a = 1;", "```"].join("\n"));
    expect(ok).toEqual([{ type: "code", lang: "js extra", code: "let a = 1;" }]);

    const bad = parseMarkdownLite(["```a`b", "x", "```"].join("\n"));
    expect(bad[0]?.type).toBe("paragraph");
  });

  it("表格单元格支持 \\| 转义竖线", () => {
    const blocks = parseQuestionBlocks(["| a\\|b | c |", "|---|---|", "| 1 | 2 |"].join("\n"));
    expect(blocks).toEqual([
      {
        type: "table",
        rows: [
          ["a\\|b", "c"],
          ["1", "2"],
        ],
      },
    ]);
  });

  it("1MB 输入（万行代码块）解析无性能悬崖", () => {
    // 此前围栏闭合行在 while 循环里每行 new RegExp，万行块纯编译开销可测；
    // 预编译后 1MB 输入应在数百毫秒内完成（CI 机放宽到 3s）
    const chunk = "int main() { return 0; } // padding line for the perf regression case\n";
    const lines: string[] = ["```c"];
    for (let i = 0; i < 20_000; i += 1) lines.push(chunk);
    lines.push("```");
    const input = lines.join("\n");
    expect(input.length).toBeGreaterThan(1_000_000);
    const started = Date.now();
    const blocks = parseQuestionBlocks(input);
    const elapsed = Date.now() - started;
    expect(blocks).toHaveLength(1);
    expect(elapsed).toBeLessThan(3000);
  });
});
/* ---------- v2.3：MarkdownLite 行内富文本（内容主题正文） ---------- */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownLite } from "@/components/md-lite";

describe("MarkdownLite 渲染（行内富文本）", () => {
  it("标题/列表/引用/段落都不再露出 ** 与反引号", () => {
    const markdown = [
      "## 复杂度",
      "最好情况是 **O(n)**，常数项用 `O(1)` 表示，平均 $n/2$。",
      "- **重点**：`swap` 只交换指针",
      "> 引用里的 **粗体** 与 `code`",
    ].join("\n");
    const html = renderToStaticMarkup(createElement(MarkdownLite, { markdown }));
    expect(html).toContain("<strong");
    expect(html).toContain("<code");
    expect(html).toContain("O(n)");
    expect(html).not.toContain("**");
    expect(html).not.toContain("`");
    expect(html).not.toContain("$");
  });

  it("strong 内嵌 code / math 递归渲染（与移动端对齐）", () => {
    const markdown = "**复杂度 `O(n)` 是常数级，平均 $n/2$**";
    const html = renderToStaticMarkup(createElement(MarkdownLite, { markdown }));
    expect(html).toContain("<strong");
    expect(html).toContain("<code");
    expect(html).toContain("n/2");
    expect(html).not.toContain("**");
    expect(html).not.toContain("`");
    expect(html).not.toContain("$");
  });
});
