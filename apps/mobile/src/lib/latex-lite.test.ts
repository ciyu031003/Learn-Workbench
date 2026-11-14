import { describe, expect, it } from "vitest";
import { formatMathText } from "./latex-lite";

describe("formatMathText", () => {
  it("turns common 408 inline formulas into readable text", () => {
    expect(formatMathText("(x_0, x_1, \\ldots, x_{n-1})")).toBe("(x₀, x₁, …, xₙ₋₁)");
    expect(formatMathText("O(n^{2})")).toBe("O(n²)");
    expect(formatMathText("a \\times b \\le c")).toBe("a × b ≤ c");
    expect(formatMathText("\\frac{n}{2}")).toBe("n/2");
    expect(formatMathText("\\sqrt{x}")).toBe("√(x)");
  });

  it("keeps arrow commands intact instead of matching shorter prefixes", () => {
    expect(formatMathText("A \\leftarrow B")).toBe("A ← B");
    expect(formatMathText("A \\leftrightarrow B")).toBe("A ↔ B");
    expect(formatMathText("A \\neq B")).toBe("A ≠ B");
  });

  it("keeps text wrappers and strips grouping braces", () => {
    expect(formatMathText("\\text{O}(n)")).toBe("O(n)");
    expect(formatMathText("\\{a, b\\}")).toBe("{a, b}");
  });

  it("falls back to a readable form for unsupported scripts", () => {
    expect(formatMathText("x^{abc}")).toBe("x^(abc)");
  });
});
