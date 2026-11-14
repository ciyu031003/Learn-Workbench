import { parseInlineRich, type InlineToken } from "@learn-workbench/shared/md-lite";

/**
 * 行内富文本扩展（v2.6.10）：
 * 共享解析器把 `$...$` 限制在 40 字符内（避免把价格/变量误判成公式），
 * 但 408 题干里有 `$(x_p, x_{p+1}, \ldots, x_{n-1}, ...)$` 这类长公式。
 * 这里只对「41–160 字符且含 LaTeX 命令/上下标/等号」的 `$...$` 二次识别，
 * 纯中文或纯数字的美元区间仍按普通文字处理。
 */
const LONG_MATH_RE = /\$([^$\n]{41,160})\$/g;

function looksLikeLongMath(inner: string): boolean {
  if (/^[\d.,\s]+$/.test(inner)) return false;
  return /[\\_^{}=<>]/.test(inner);
}

export function parseInlineRichExtended(text: string): InlineToken[] {
  const source = String(text ?? "");
  const tokens = parseInlineRich(source);
  const out: InlineToken[] = [];

  for (const token of tokens) {
    if (token.type !== "text") {
      out.push(token);
      continue;
    }
    let last = 0;
    let found = false;
    for (const match of token.value.matchAll(LONG_MATH_RE)) {
      const inner = match[1] ?? "";
      if (!looksLikeLongMath(inner)) continue;
      const index = match.index ?? 0;
      if (index > last) out.push({ type: "text", value: token.value.slice(last, index) });
      out.push({ type: "math", value: inner });
      last = index + match[0].length;
      found = true;
    }
    if (!found) {
      out.push(token);
      continue;
    }
    if (last < token.value.length) out.push({ type: "text", value: token.value.slice(last) });
  }

  return out.length > 0 ? out : [{ type: "text", value: source }];
}
