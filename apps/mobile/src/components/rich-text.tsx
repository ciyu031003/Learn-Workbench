import { Text, type StyleProp, type TextStyle } from "react-native";
import { parseInlineRich } from "@learn-workbench/shared/md-lite";

/**
 * 行内富文本（移动端）：把 `**加粗**` / `` `代码` `` / `$公式$` 渲染成原生 Text 嵌套节点。
 * 与 Web 端共用 `parseInlineRich`，两端表现一致；不注入任何 HTML。
 */
export function RichText({
  text,
  style,
  codeStyle,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  codeStyle?: StyleProp<TextStyle>;
}) {
  const tokens = parseInlineRich(text);
  if (tokens.length === 1 && tokens[0].type === "text") {
    return <Text style={style}>{tokens[0].value}</Text>;
  }
  return (
    <Text style={style}>
      {tokens.map((token, index) => {
        if (token.type === "strong") {
          return (
            <Text key={index} style={{ fontWeight: "700" }}>
              {token.value}
            </Text>
          );
        }
        if (token.type === "code" || token.type === "math") {
          return (
            <Text key={index} style={codeStyle}>
              {token.value}
            </Text>
          );
        }
        return <Text key={index}>{token.value}</Text>;
      })}
    </Text>
  );
}
