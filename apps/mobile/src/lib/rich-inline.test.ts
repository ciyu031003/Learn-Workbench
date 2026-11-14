import { describe, expect, it } from "vitest";
import { parseInlineRichExtended } from "./rich-inline";

describe("parseInlineRichExtended", () => {
  it("recognizes long formulas that the shared parser intentionally skips", () => {
    const text = "$(x_p, x_{p+1}, \\ldots, x_{n-1}, x_0, x_1, \\ldots, x_{p-1})$";
    const tokens = parseInlineRichExtended(text);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ type: "math" });
  });

  it("keeps price-like dollar ranges as plain text", () => {
    const tokens = parseInlineRichExtended("价格 $5 到 $10 之间，预算有限");
    expect(tokens.every((token) => token.type === "text")).toBe(true);
  });

  it("keeps order around long math", () => {
    const tokens = parseInlineRichExtended("前 $(a_{1}+a_{2}+a_{3}+a_{4}+a_{5}+a_{6})$ 后");
    expect(tokens.map((token) => token.type)).toEqual(["text", "math", "text"]);
  });
});
