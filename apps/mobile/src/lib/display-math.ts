/**
 * 408 答案里的展示公式（\\[...\\]）拆分与矩阵解析（v2.6.10）。
 *
 * 移动端没有 KaTeX；这里只做两件事：
 * 1) 把段落拆成「普通文字 / 展示公式」片段；
 * 2) 识别 bmatrix / pmatrix / vmatrix / matrix，用原生表格渲染矩阵。
 * 其余公式交给 formatMathText 做可读化处理。
 */

export type DisplayMathPart =
  | { type: "text"; value: string }
  | { type: "math"; value: string };

const DISPLAY_MATH_RE = /\\\[([\s\S]*?)\\\]/g;

/** 把一段文字按 \\[...\\] 拆成文字与公式片段；没有公式时返回单个文字片段 */
export function splitDisplayMath(text: string): DisplayMathPart[] {
  const source = String(text ?? "");
  if (!source) return [];
  const parts: DisplayMathPart[] = [];
  let last = 0;
  for (const match of source.matchAll(DISPLAY_MATH_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: "text", value: source.slice(last, index) });
    parts.push({ type: "math", value: match[1] ?? "" });
    last = index + match[0].length;
  }
  if (last < source.length) parts.push({ type: "text", value: source.slice(last) });
  return parts.length > 0 ? parts : [{ type: "text", value: source }];
}

export interface MatrixSpec {
  env: "bmatrix" | "pmatrix" | "vmatrix" | "matrix";
  rows: string[][];
}

const MATRIX_RE = /\\begin\{(bmatrix|pmatrix|vmatrix|matrix)\}([\s\S]*?)\\end\{\1\}/;

/** 解析矩阵环境；不是矩阵返回 null */
export function parseMatrix(tex: string): MatrixSpec | null {
  const match = MATRIX_RE.exec(String(tex ?? ""));
  if (!match) return null;
  const env = match[1] as MatrixSpec["env"];
  const rows = (match[2] ?? "")
    .split(/\\\\/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
    .map((row) => row.split("&").map((cell) => cell.trim()));
  if (rows.length === 0) return null;
  return { env, rows };
}
