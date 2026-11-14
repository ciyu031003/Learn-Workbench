import { Text, type StyleProp, type TextStyle } from "react-native";
import type { InlineToken } from "@learn-workbench/shared/md-lite";
import { formatMathText } from "@/lib/latex-lite";
import { parseInlineRichExtended } from "@/lib/rich-inline";

/**
 * 行内富文本（移动端）：把 `**加粗**` / ```代码``` / `$公式$` 渲染成原生 Text 嵌套节点。
 * 分词与 Web 端共用 `parseInlineRich`（不注入任何 HTML）；两端唯一的差别是
 * 移动端会再把 strong 内部的行内代码/公式递归渲染一层，Web 端仍按 token.value 原样输出。
 *
 * v2.2：共享解析器把 `**粗体 **` 整体当成一个 strong token（内部不再切分），
 * 当粗体里套了行内代码/公式（如 `**复杂度 `O(n)` 是常数级**`）时会漏出反引号与 $。
 * 这里对 strong token 的 value 再做一次解析（深度上限 2，避免异常输入递归），
 * 让粗体内部的 code / math 也按富文本渲染 —— 不改变 shared 解析器语义（Web 共用）。
 */
const MAX_NESTED_DEPTH = 2;

function InlineTokens({
  tokens,
  codeStyle,
  depth,
}: {
  tokens: InlineToken[];
  codeStyle?: StyleProp<TextStyle>;
  depth: number;
}): React.JSX.Element {
  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === "strong") {
          const nested = depth < MAX_NESTED_DEPTH ? parseInlineRichExtended(token.value) : null;
          return (
            <Text key={index} style={{ fontWeight: "700" }}>
              {nested ? (
                <InlineTokens tokens={nested} codeStyle={codeStyle} depth={depth + 1} />
              ) : (
                token.value
              )}
            </Text>
          );
        }
        if (token.type === "code" || token.type === "math") {
          return (
            <Text key={index} style={codeStyle}>
              {token.type === "math" ? formatMathText(token.value) : token.value}
            </Text>
          );
        }
        return <Text key={index}>{token.value}</Text>;
      })}
    </>
  );
}

export function RichText({
  text,
  style,
  codeStyle,
  numberOfLines,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  codeStyle?: StyleProp<TextStyle>;
  /** 与 RN Text 一致：只对多行截断场景（列表预览、卡片摘要）开放 */
  numberOfLines?: number;
}) {
  const tokens = parseInlineRichExtended(text);
  if (tokens.length === 1 && tokens[0].type === "text") {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {tokens[0].value}
      </Text>
    );
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      <InlineTokens tokens={tokens} codeStyle={codeStyle} depth={0} />
    </Text>
  );
}
