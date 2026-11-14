import { describe, expect, it } from "vitest";
import { parseQuestionBlocks } from "@learn-workbench/shared/md-lite";
import { parseMatrix, splitDisplayMath } from "./display-math";

describe("splitDisplayMath", () => {
  it("returns a single text part when there is no display math", () => {
    expect(splitDisplayMath("普通文字 $x$ 保持不变")).toEqual([{ type: "text", value: "普通文字 $x$ 保持不变" }]);
  });

  it("splits text and display math while keeping order", () => {
    const parts = splitDisplayMath("邻接矩阵：\n\\[\nA = 1\n\\]\n结束");
    expect(parts.map((p) => p.type)).toEqual(["text", "math", "text"]);
    expect(parts[1]).toEqual({ type: "math", value: "\nA = 1\n" });
  });
});

describe("parseMatrix", () => {
  it("parses bmatrix rows and cells", () => {
    const matrix = parseMatrix("\\[\nA = \\begin{bmatrix}0 & 1 \\\\ 2 & 3\\end{bmatrix}\n\\]");
    expect(matrix).toEqual({
      env: "bmatrix",
      rows: [["0", "1"], ["2", "3"]],
    });
  });

  it("returns null for non-matrix formulas", () => {
    expect(parseMatrix("\\frac{1}{2}")).toBeNull();
  });
});

describe("parseQuestionBlocks br handling", () => {
  it("keeps a table row intact when cells contain <br>", () => {
    const blocks = parseQuestionBlocks(
      "| 页号 | 存在位<br>1：存在<br>0：不存在 |\n|---|---|\n| 1 | 1 |",
    );
    expect(blocks).toEqual([
      { type: "table", rows: [["页号", "存在位\n1：存在\n0：不存在"], ["1", "1"]] },
    ]);
  });

  it("turns <br> into a line break inside paragraphs", () => {
    const blocks = parseQuestionBlocks("第一行<br>第二行");
    expect(blocks).toEqual([{ type: "paragraph", lines: ["第一行", "第二行"] }]);
  });

  it("does not rewrite <br> inside fenced code", () => {
    const blocks = parseQuestionBlocks("```html\n<br>\n```");
    expect(blocks).toEqual([{ type: "code", lang: "html", code: "<br>" }]);
  });
});
