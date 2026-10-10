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
