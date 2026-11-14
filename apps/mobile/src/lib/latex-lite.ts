/**
 * 轻量 LaTeX → 可读文本（移动端行内公式专用，v2.6.10）。
 *
 * 408 题干与答案里有大量 \$...\$ / \\(...\\) 行内公式，移动端没有 KaTeX，
 * 直接渲染会把 \\ldots、\\times、^{2} 等命令原样露出来。这里只做「可读化」：
 * 常见符号换 Unicode、上下标换 Unicode 角标，无法转换的结构退化为括号形式，
 * 不做完整排版，保证任何输入都能安全显示。
 */

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};

const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ",
  r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

const SYMBOLS: [string, string][] = [
  ["\\ldots", "…"], ["\\dots", "…"], ["\\cdots", "⋯"], ["\\dotsb", "…"],
  ["\\times", "×"], ["\\cdot", "·"], ["\\div", "÷"], ["\\pm", "±"], ["\\mp", "∓"],
  ["\\leq", "≤"], ["\\le", "≤"], ["\\geq", "≥"], ["\\ge", "≥"],
  ["\\neq", "≠"], ["\\ne", "≠"], ["\\approx", "≈"], ["\\equiv", "≡"],
  ["\\infty", "∞"], ["\\propto", "∝"],
  ["\\rightarrow", "→"], ["\\to", "→"], ["\\leftarrow", "←"],
  ["\\Rightarrow", "⇒"], ["\\Leftarrow", "⇐"], ["\\leftrightarrow", "↔"],
  ["\\sum", "Σ"], ["\\prod", "∏"], ["\\int", "∫"], ["\\partial", "∂"],
  ["\\alpha", "α"], ["\\beta", "β"], ["\\gamma", "γ"], ["\\delta", "δ"],
  ["\\epsilon", "ε"], ["\\varepsilon", "ε"], ["\\zeta", "ζ"], ["\\eta", "η"],
  ["\\theta", "θ"], ["\\lambda", "λ"], ["\\mu", "μ"], ["\\nu", "ν"],
  ["\\xi", "ξ"], ["\\pi", "π"], ["\\rho", "ρ"], ["\\sigma", "σ"],
  ["\\tau", "τ"], ["\\phi", "φ"], ["\\varphi", "φ"], ["\\chi", "χ"],
  ["\\psi", "ψ"], ["\\omega", "ω"], ["\\Omega", "Ω"], ["\\Delta", "Δ"],
  ["\\Sigma", "Σ"], ["\\Pi", "Π"], ["\\Theta", "Θ"], ["\\Lambda", "Λ"],
  ["\\degree", "°"], ["\\circ", "°"], ["\\%", "%"],
  ["\\quad", " "], ["\\qquad", "  "], ["\\,", ""], ["\\;", ""], ["\\!", ""], ["\\ ", " "],
  ["\\{", "{"], ["\\}", "}"], ["\\_", "_"], ["\\#", "#"], ["\\&", "&"],
];

function toScript(value: string, table: Record<string, string>, marker: "^" | "_"): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  let out = "";
  for (const char of trimmed) {
    const mapped = table[char];
    if (!mapped) return marker + "(" + trimmed + ")";
    out += mapped;
  }
  return out;
}

/** 把一段行内公式转成可读文本（纯函数，幂等性不做保证） */
export function formatMathText(input: string): string {
  let text = String(input ?? "").trim();
  if (!text) return "";

  // \frac{a}{b} → a/b（最多三层，足够覆盖行内公式）
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2");
    if (next === text) break;
    text = next;
  }

  // \sqrt{x} → √(x)，\sqrt[3]{x} → ∛(x)
  text = text
    .replace(/\\sqrt\[3\]\{([^{}]*)\}/g, "∛($1)")
    .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");

  // 上下标：\^{...}/\_{...} 与单字符形式
  text = text
    .replace(/\^\{([^{}]*)\}/g, (_, inner: string) => toScript(inner, SUPERSCRIPT, "^"))
    .replace(/\^([A-Za-z0-9+\-=])/g, (_, inner: string) => toScript(inner, SUPERSCRIPT, "^"))
    .replace(/_\{([^{}]*)\}/g, (_, inner: string) => toScript(inner, SUBSCRIPT, "_"))
    .replace(/_([A-Za-z0-9+\-=])/g, (_, inner: string) => toScript(inner, SUBSCRIPT, "_"));

  // 常见命令：按长度倒序，避免 \\le 抢先吃掉 \\leftarrow、\\neq 抢先吃掉 \\ne
  for (const [from, to] of [...SYMBOLS].sort((a, b) => b[0].length - a[0].length)) {
    text = text.split(from).join(to);
  }
  // \text{...} / \mathrm{...} / \operatorname{...} 只留内容
  text = text
    .replace(/\\(?:text|mathrm|operatorname|mathbf|mathit)\{([^{}]*)\}/g, "$1")
    // 反斜杠空白命令残留
    .replace(/\\[,;! ]/g, " ")
    // 未识别的命令保留可读形式（去掉反斜杠，避免像代码）
    .replace(/\\([A-Za-z]+)/g, "$1");

  return text.replace(/\s+/g, " ").trim();
}
