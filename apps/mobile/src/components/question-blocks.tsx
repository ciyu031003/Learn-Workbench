import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { parseQuestionBlocks, type QuestionBlock } from "@learn-workbench/shared/md-lite";
import { RichText } from "@/components/rich-text";
import { useTheme } from "@/theme";
import { radius, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 题库块级富文本（移动端）：408 真题 / 面试题的题干与答案。
 *
 * 与 Web 端 `components/question-blocks.tsx` 共用 `parseQuestionBlocks`（段落保留原始行，
 * 不做 markdown 的换行合并）。这里映射到 RN 原生节点：
 *  - 标题 → 加粗行（层级压成两档字号，不放大正文节奏）；
 *  - 管道表格 → 逐行等宽呈现（RN 没有轻量表格原语，保留竖线对齐反而最诚实）；
 *  - 围栏代码块 → 弱底色块；行内标记（**粗** / `码` / $式$ / \(式\)）走 RichText。
 */
function BlockView({
  block,
  colors,
  baseStyle,
  codeStyle,
}: {
  block: QuestionBlock;
  colors: ThemeColors;
  baseStyle?: StyleProp<TextStyle>;
  codeStyle?: StyleProp<TextStyle>;
}) {
  switch (block.type) {
    case "heading": {
      const headingStyle: StyleProp<TextStyle> =
        block.level <= 2
          ? { ...typography.callout, fontWeight: "800", color: colors.text }
          : { ...typography.caption, fontWeight: "700", color: colors.textSecondary };
      return <RichText text={block.text} style={headingStyle} codeStyle={codeStyle} />;
    }
    case "code":
      return (
        <View
          style={{
            borderRadius: radius.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <Text style={{ ...typography.caption, lineHeight: 18, color: colors.textSecondary }} selectable>
            {block.code}
          </Text>
        </View>
      );
    case "table": {
      /**
       * v2.2：表格按表格渲染（首行表头），不再用「a  |  b  |  c」的管道拼接。
       * 单元格宽度按列均分并给最小宽度，窄屏走横向滚动；行内标记交给 RichText。
       */
      const columnCount = Math.max(...block.rows.map((row) => row.length), 1);
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View
            style={{
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {block.rows.map((row, rowIndex) => (
              <View
                key={rowIndex}
                style={{
                  flexDirection: "row",
                  borderTopWidth: rowIndex === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                  backgroundColor: rowIndex === 0 ? colors.surface : "transparent",
                }}
              >
                {Array.from({ length: columnCount }).map((_, column) => (
                  <View
                    key={column}
                    style={{
                      minWidth: 96,
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      justifyContent: "center",
                      borderLeftWidth: column === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderLeftColor: colors.border,
                    }}
                  >
                    <RichText
                      text={row[column] ?? ""}
                      style={[
                        { ...typography.caption, lineHeight: 18, color: colors.textSecondary },
                        rowIndex === 0 && { color: colors.text, fontWeight: "800" },
                      ]}
                      codeStyle={codeStyle}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    }
    case "list":
      return (
        <View style={{ gap: 4 }}>
          {block.items.map((item, i) => (
            <Text key={i} style={[{ ...typography.callout, color: colors.text }, baseStyle]} selectable>
              <Text style={{ ...typography.callout, color: colors.primary, fontWeight: "800" }}>
                {block.ordered ? `${i + 1}. ` : "· "}
              </Text>
              <RichText text={item} style={[{ ...typography.callout, color: colors.text }, baseStyle]} codeStyle={codeStyle} />
            </Text>
          ))}
        </View>
      );
    case "paragraph":
      return (
        <Text style={[{ ...typography.callout, color: colors.text }, baseStyle]} selectable>
          {block.lines.map((line, i) => (
            <Text key={i}>
              {i > 0 ? "\n" : ""}
              <RichText text={line} style={[{ ...typography.callout, color: colors.text }, baseStyle]} codeStyle={codeStyle} />
            </Text>
          ))}
        </Text>
      );
    default:
      return null;
  }
}

export function QuestionBlocks({
  text,
  style,
  compact = false,
  codeStyle,
}: {
  text: string;
  /** 段落/列表行的 TextStyle 覆盖（字号与颜色跟调用场景走） */
  style?: StyleProp<TextStyle>;
  /** 紧凑场景（选项、对比栏）压一档间距 */
  compact?: boolean;
  codeStyle?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  const blocks = useMemo(() => parseQuestionBlocks(text), [text]);
  if (blocks.length === 0) return null;
  return (
    <View style={{ gap: compact ? 6 : 10 }}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} colors={colors} baseStyle={style} codeStyle={codeStyle} />
      ))}
    </View>
  );
}
