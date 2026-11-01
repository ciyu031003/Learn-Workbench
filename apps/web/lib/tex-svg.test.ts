import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_MATH_PER_PAYLOAD,
  MAX_TEX_LENGTH,
  __resetTexSvgCache,
  addMathToBlocks,
  normalizeSvgRoot,
  readSvgViewBox,
  splitMathSegments,
  stripMathDelimiters,
  texToSvg,
} from "./tex-svg";

/**
 * 服务端 TeX → SVG（P7）单测：
 * - 正常公式产出「自包含、可给 react-native-svg 用」的 SVG（无 defs/use/style/ex 单位）；
 * - 非法 TeX / 未知宏 / 超长 / 危险宏一律 null（App 回退等宽文本）；
 * - 行内切段与 blocks 富化是纯函数，App/Web 共用同一份结果。
 */

beforeEach(() => {
  __resetTexSvgCache();
});

describe("texToSvg", () => {
  it("渲染合法公式：自包含 SVG，去掉 RN 不认的属性", () => {
    const svg = texToSvg("E = mc^2");
    expect(svg).toBeTruthy();
    expect(svg!.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="')).toBe(true);
    expect(svg!.includes("<g")).toBe(true);
    // fontCache: none → 不能有 defs/use（react-native-svg 对 use+xlink 支持不完整）
    expect(svg!.includes("<defs")).toBe(false);
    expect(svg!.includes("<use")).toBe(false);
    // width/height/style 都是 HTML 语义，RN 尺寸按 viewBox 换算
    expect(/<svg[^>]*style=/.test(svg!)).toBe(false);
    expect(/<svg[^>]*width=/.test(svg!)).toBe(false);
    expect(svg!.includes("currentColor")).toBe(true);
  });

  it("displayMode 与行内模式产出不同结果", () => {
    __resetTexSvgCache();
    const inline = texToSvg("\\int_0^1 f(x) dx", false);
    const display = texToSvg("\\int_0^1 f(x) dx", true);
    expect(inline).toBeTruthy();
    expect(display).toBeTruthy();
    expect(display).not.toBe(inline);
  });

  it("同一公式走缓存（多次调用完全一致），重置后仍可渲染", () => {
    const first = texToSvg("a^2 + b^2");
    const second = texToSvg("a^2 + b^2");
    expect(second).toBe(first);
    __resetTexSvgCache();
    expect(texToSvg("a^2 + b^2")).toBe(first);
  });

  it("非法 TeX 返回 null（MathJax 不抛错，输出里是 merror）", () => {
    expect(texToSvg("\\frac{")).toBeNull();
    expect(texToSvg("\\notacommand{x}")).toBeNull();
    expect(texToSvg("")).toBeNull();
    expect(texToSvg("   ")).toBeNull();
  });

  it("超长 TeX 返回 null", () => {
    expect(texToSvg("x".repeat(MAX_TEX_LENGTH + 1))).toBeNull();
    expect(texToSvg("x".repeat(MAX_TEX_LENGTH))).toBeTruthy();
  });

  it("危险宏（外部读写 / HTML 注入）返回 null", () => {
    expect(texToSvg("\\href{javascript:alert(1)}{x}")).toBeNull();
    expect(texToSvg("\\input{/etc/passwd}")).toBeNull();
    expect(texToSvg("\\url{https://evil.example}")).toBeNull();
    expect(texToSvg("\\class{evil}{x}")).toBeNull();
    expect(texToSvg("\\def\\x{y}")).toBeNull();
    expect(texToSvg("<script>alert(1)</script>")).toBeNull();
    // 正常排版命令不受影响
    expect(texToSvg("\\text{最坏情况 } O(n^2)")).toBeTruthy();
  });
});

describe("normalizeSvgRoot / readSvgViewBox", () => {
  it("只保留 xmlns 与 viewBox", () => {
    const svg = normalizeSvgRoot('<svg style="vertical-align: -0.5ex;" width="10ex" role="img" viewBox="0 -800 2000 1000"><g></g></svg>');
    expect(svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -800 2000 1000"><g></g></svg>');
  });

  it("viewBox 取宽高，异常值给兜底", () => {
    expect(readSvgViewBox('<svg viewBox="0 -833.9 5881.6 1186.7">')).toEqual({ width: 5881.6, height: 1186.7 });
    expect(readSvgViewBox("not svg")).toEqual({ width: 1000, height: 500 });
    expect(readSvgViewBox('<svg viewBox="0 0 0 0">')).toEqual({ width: 1000, height: 500 });
  });
});

describe("splitMathSegments / stripMathDelimiters", () => {
  const stub = (tex: string) => "SVG(" + tex + ")";

  it("把行内公式切成 text/math 段（含首尾文本）", () => {
    const segments = splitMathSegments("已知复杂度 $O(n^2)$ 与均摊 $O(1)$ 的结论", stub);
    expect(segments).toHaveLength(5);
    expect(segments[0]).toEqual({ type: "text", text: "已知复杂度 " });
    expect(segments[1]).toEqual({ type: "math", tex: "O(n^2)", svg: "SVG(O(n^2))" });
    expect(segments[2]).toEqual({ type: "text", text: " 与均摊 " });
    expect(segments[3]).toMatchObject({ type: "math", tex: "O(1)" });
    expect(segments[4]).toEqual({ type: "text", text: " 的结论" });
  });

  it("没有公式时返回单个 text 段；空输入返回空数组", () => {
    expect(splitMathSegments("纯文本", stub)).toEqual([{ type: "text", text: "纯文本" }]);
    expect(splitMathSegments("", stub)).toEqual([]);
  });

  it("空公式、跨美元符与块公式不误切", () => {
    expect(splitMathSegments("价格 $ 与 $ 不是公式", stub)).toEqual([{ type: "text", text: "价格 $ 与 $ 不是公式" }]);
    expect(splitMathSegments("$$x^2$$ 是块公式", stub)).toEqual([{ type: "text", text: "$$x^2$$ 是块公式" }]);
    // 单侧美元符不配对时也不切
    expect(splitMathSegments("价格 $5 与 $x$ 混排", stub)).toEqual([
      { type: "text", text: "价格 $5 与 " },
      { type: "math", tex: "x", svg: "SVG(x)" },
      { type: "text", text: " 混排" },
    ]);
  });

  it("去掉定界符便于摘要", () => {
    expect(stripMathDelimiters("复杂度 $O(n)$，空间 $O(1)$")).toBe("复杂度 O(n)，空间 O(1)");
  });
});

describe("addMathToBlocks", () => {
  const stub = (tex: string, display: boolean) => (display ? "D:" : "I:") + tex;

  it("math 块补 svg（display 模式），文本块补 segments", () => {
    const blocks = addMathToBlocks(
      [
        { type: "heading", id: "h1", level: 2, text: "一、复杂度" },
        { type: "paragraph", lines: ["时间复杂度 $O(n\\log n)$ 的证明"] },
        { type: "math", tex: "T(n) = 2T(n/2) + n" },
        { type: "quote", lines: ["最坏 $O(n^2)$"] },
        { type: "list", ordered: false, items: [{ text: "均摊 $O(1)$", depth: 0 }] },
        { type: "table", header: ["结构", "复杂度"], rows: [["顺序表", "$O(1)$"]], align: ["left", "left"] },
        { type: "code", lang: "c", code: "int x;" },
        { type: "divider" },
      ],
      stub,
    ) as Array<Record<string, unknown>>;

    expect(blocks[0]).toMatchObject({ type: "heading", text: "一、复杂度" });
    expect(blocks[1].segments).toEqual([
      { type: "text", text: "时间复杂度 " },
      { type: "math", tex: "O(n\\log n)", svg: "I:O(n\\log n)" },
      { type: "text", text: " 的证明" },
    ]);
    expect(blocks[2]).toMatchObject({ type: "math", tex: "T(n) = 2T(n/2) + n", svg: "D:T(n) = 2T(n/2) + n" });
    expect(blocks[3].segments).toEqual([
      { type: "text", text: "最坏 " },
      { type: "math", tex: "O(n^2)", svg: "I:O(n^2)" },
    ]);
    expect((blocks[4].items as Array<Record<string, unknown>>)[0].segments).toHaveLength(2);
    expect(blocks[5].headerSegments).toEqual([[{ type: "text", text: "结构" }], [{ type: "text", text: "复杂度" }]]);
    expect((blocks[5].rowSegments as unknown[][])[0][1]).toEqual([
      { type: "math", tex: "O(1)", svg: "I:O(1)" },
    ]);
    // 非文本块原样保留
    expect(blocks[6]).toMatchObject({ type: "code", lang: "c" });
    expect(blocks[7]).toMatchObject({ type: "divider" });
  });

  it("不改入参（纯函数）", () => {
    const input = [{ type: "paragraph", lines: ["$x$"] }];
    addMathToBlocks(input, stub);
    expect(input).toEqual([{ type: "paragraph", lines: ["$x$"] }]);
  });

  it("公式数量有预算上限，超出部分 svg 为 null（仍保留 tex 段）", () => {
    const blocks = Array.from({ length: MAX_MATH_PER_PAYLOAD + 5 }, (_, index) => ({
      type: "paragraph",
      lines: ["x_" + index + " $a_" + index + "$"],
    }));
    const out = addMathToBlocks(blocks, stub) as Array<{ segments: Array<{ type: string; svg?: string | null }> }>;
    const rendered = out.filter((block) => block.segments.some((segment) => segment.type === "math" && segment.svg));
    expect(rendered).toHaveLength(MAX_MATH_PER_PAYLOAD);
    const lastMath = out[out.length - 1].segments.find((segment) => segment.type === "math");
    expect(lastMath).toMatchObject({ type: "math", svg: null });
  });

  it("非数组输入返回空数组", () => {
    expect(addMathToBlocks(null, stub)).toEqual([]);
    expect(addMathToBlocks("x", stub)).toEqual([]);
  });
});
