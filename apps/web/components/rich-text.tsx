import { parseInlineRich } from "@learn-workbench/shared";

/**
 * 行内富文本渲染（题库 / 知识点正文）。
 *
 * 内容里偶发 Markdown 风格标记（`**加粗**`、`` `代码` ``、`$公式$`），纯文本渲染会把符号原样显示。
 * 这里按 token 渲染成原生节点 —— **不用 dangerouslySetInnerHTML**，零 XSS 面。
 * `__name__` 这类 Python dunder 由解析器保证不被误当成强调。
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const tokens = parseInlineRich(text);
  if (tokens.length === 1 && tokens[0].type === "text") {
    return <span className={className}>{tokens[0].value}</span>;
  }
  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type === "strong") return <strong key={index} className="font-semibold">{token.value}</strong>;
        if (token.type === "code" || token.type === "math") {
          return (
            <code
              key={index}
              className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.92em] text-foreground"
            >
              {token.value}
            </code>
          );
        }
        return <span key={index}>{token.value}</span>;
      })}
    </span>
  );
}
