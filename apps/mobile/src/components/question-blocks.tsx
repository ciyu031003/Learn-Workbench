import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { parseQuestionBlocks, type QuestionBlock } from "@learn-workbench/shared/md-lite";
import { RichText } from "@/components/rich-text";
import { formatMathText } from "@/lib/latex-lite";
import { parseMatrix, splitDisplayMath } from "@/lib/display-math";
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
      // 标题必须比正文更大或至少同号加粗：此前 ### 用了 caption(12)，
      // 比正文 callout(15) 还小，答案里的小节标题反而像脚注。
      const headingStyle: StyleProp<TextStyle> =
        block.level === 1
          ? { ...typography.headline, fontWeight: "800", color: colors.text }
          : block.level === 2
            ? { ...typography.section, fontWeight: "800", color: colors.text }
            : { ...typography.callout, lineHeight: 22, fontWeight: "800", color: colors.text };
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
            gap: 5,
          }}
        >
          {block.lang ? (
            <Text style={{ ...typography.micro, color: colors.textMuted, textTransform: "uppercase" }}>
              {block.lang}
            </Text>
          ) : null}
          {/* 代码不折行：横向滚动比把一行 80 列的 C 代码折成三行更可读 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <Text
              selectable
              style={{
                ...typography.caption,
                lineHeight: 18,
                color: colors.text,
                fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
              }}
            >
              {block.code}
            </Text>
          </ScrollView>
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
    case "paragraph": {
      const source = block.lines.join("\n");
      const parts = splitDisplayMath(source);
      if (!parts.some((part) => part.type === "math")) {
        return (
          <Text style={[{ ...typography.callout, color: colors.text }, baseStyle]} selectable>
            {block.lines.map((line, index) => (
              <Text key={index}>
                {index > 0 ? "\n" : ""}
                <RichText text={line} style={[{ ...typography.callout, color: colors.text }, baseStyle]} codeStyle={codeStyle} />
              </Text>
            ))}
          </Text>
        );
      }
      return (
        <View style={{ gap: 8 }}>
          {parts.map((part, index) => {
            if (part.type === "math") {
              return <FormulaBlock key={index} tex={part.value} colors={colors} />;
            }
            const value = part.value.replace(/^\n+|\n+$/g, "");
            if (!value.trim()) return null;
            return (
              <RichText
                key={index}
                text={value}
                style={[{ ...typography.callout, color: colors.text }, baseStyle]}
                codeStyle={codeStyle}
              />
            );
          })}
        </View>
      );
    }
    default:
      return null;
  }
}

/** 展示公式：矩阵用原生表格，其余公式做可读化后按代码块呈现 */
function FormulaBlock({ tex, colors }: { tex: string; colors: ThemeColors }) {
  const matrix = parseMatrix(tex);
  if (matrix) {
    const bracket = matrix.env === "pmatrix" ? "paren" : matrix.env === "vmatrix" ? "bar" : matrix.env === "matrix" ? "none" : "bracket";
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "stretch", gap: 5, paddingVertical: 4 }}>
          {bracket !== "none" ? <MatrixBracket side="left" kind={bracket} color={colors.textMuted} /> : null}
          <View style={{ gap: 5, justifyContent: "center" }}>
            {matrix.rows.map((row, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: "row", gap: 14, justifyContent: "center" }}>
                {row.map((cell, cellIndex) => (
                  <Text
                    key={cellIndex}
                    style={{ ...typography.caption, lineHeight: 19, color: colors.text, textAlign: "center", minWidth: 18 }}
                  >
                    {formatMathText(cell)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          {bracket !== "none" ? <MatrixBracket side="right" kind={bracket} color={colors.textMuted} /> : null}
        </View>
      </ScrollView>
    );
  }
  const lines = tex
    .split(/\n+/)
    .map((line) => formatMathText(line))
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <Text
          selectable
          style={{
            ...typography.caption,
            lineHeight: 19,
            color: colors.text,
            fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
          }}
        >
          {lines.join("\n")}
        </Text>
      </ScrollView>
    </View>
  );
}

/** 矩阵括号：用边框拉伸到矩阵高度，避免固定 fontSize 超出字阶门禁 */
function MatrixBracket({
  side,
  kind,
  color,
}: {
  side: "left" | "right";
  kind: "bracket" | "paren" | "bar";
  color: string;
}) {
  if (kind === "bar") {
    return <View style={{ width: StyleSheet.hairlineWidth * 2, alignSelf: "stretch", marginVertical: 2, backgroundColor: color }} />;
  }
  if (kind === "paren") {
    return <Text style={{ ...typography.display, color }}>{side === "left" ? "(" : ")"}</Text>;
  }
  return (
    <View
      style={{
        width: 7,
        alignSelf: "stretch",
        marginVertical: 2,
        borderColor: color,
        borderLeftWidth: side === "left" ? StyleSheet.hairlineWidth * 2 : 0,
        borderRightWidth: side === "right" ? StyleSheet.hairlineWidth * 2 : 0,
        borderTopWidth: StyleSheet.hairlineWidth * 2,
        borderBottomWidth: StyleSheet.hairlineWidth * 2,
      }}
    />
  );
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
