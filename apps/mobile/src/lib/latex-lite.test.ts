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

  it("removes \\left/\\right and renders common set operators", () => {
    expect(formatMathText("\\left\\{ x \\in A \\right\\}")).toBe("{ x ∈ A }");
    expect(formatMathText("\\lfloor n/2 \\rfloor + 1")).toBe("⌊ n/2 ⌋ + 1");
    expect(formatMathText("x \\notin \\emptyset")).toBe("x ∉ ∅");
  });

  it("cleans math wrappers / environments that have no server SVG", () => {
    expect(formatMathText("\\mathcal{O}(\\log n)")).toBe("O(log n)");
    expect(formatMathText("\\mathbb{R} \\subseteq \\mathbb{R}^2")).toBe("R ⊆ R²");
    expect(formatMathText("\\operatorname*{argmax}_{x} f(x)")).toBe("argmaxₓ f(x)");
    expect(formatMathText("\\begin{cases} a \\\\ b \\end{cases}")).toBe("a ； b");
    expect(formatMathText("\\overline{AB} + \\vec{v}")).toBe("‾(AB) + →(v)");
  });

  it("renders 408 complexity formulas without leaking raw commands", () => {
    expect(formatMathText("T(n)=T_1(n)+T_2(n)=O(\\max(f(n),g(n)))")).toBe(
      "T(n)=T₁(n)+T₂(n)=O(max(f(n),g(n)))",
    );
    expect(formatMathText("O(\\log_2 n)")).toBe("O(log₂ n)");
    expect(formatMathText("O(n\\log_2 n)")).toBe("O(nlog₂ n)");
    expect(formatMathText("O(2^n)")).toBe("O(2ⁿ)");
    expect(formatMathText("T_1(n)\\times T_2(n)")).toBe("T₁(n)× T₂(n)");
  });
});
