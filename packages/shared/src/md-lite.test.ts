import { describe, expect, it } from "vitest";
import { parseInlineRich, parseQuestionBlocks } from "./md-lite";

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
    expect(parseInlineRich("用 `shl` 指令")).toEqual([
      { type: "text", value: "用 " },
      { type: "code", value: "shl" },
      { type: "text", value: " 指令" },
    ]);
    expect(parseInlineRich("X=$2^7$×29/32")).toEqual([
      { type: "text", value: "X=" },
      { type: "math", value: "2^7" },
      { type: "text", value: "×29/32" },
    ]);
  });

  it("\\(...\\) LaTeX 定界符渲染为公式 token（内部允许空格）", () => {
    expect(parseInlineRich("设指针 \\( p \\) 与 \\(count = 0\\)")).toEqual([
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

  it("\\( 内部为空 → 不认，原样保留", () => {
    expect(parseInlineRich("空 \\(\\) 对")).toEqual([{ type: "text", value: "空 \\(\\) 对" }]);
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
    const blocks = parseQuestionBlocks(["| 时钟节拍 | 功能 | 有效控制信号 |", "|---|---|---|", "| C5 | MAR ← (R1) | R1out, MARin |"].join("\n"));
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
    const blocks = parseQuestionBlocks("[ data | link ]");
    expect(blocks).toEqual([{ type: "paragraph", lines: ["[ data | link ]"] }]);
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
    const blocks = parseQuestionBlocks("图 G = <v0, v1, v2>");
    expect(blocks).toEqual([{ type: "paragraph", lines: ["图 G = <v0, v1, v2>"] }]);
  });

  it("空输入 → 空数组", () => {
    expect(parseQuestionBlocks("  \n\n")).toEqual([]);
  });
});
