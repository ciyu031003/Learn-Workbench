import { Fragment, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { parseMarkdownLite, splitInlineCode, type MdBlock } from "@learn-workbench/shared";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

function Inline({ text, mono }: { text: string; mono: ThemeColors }) {
  return (
    <>
      {splitInlineCode(text).map((part, index) =>
        part.code ? (
          <Text key={index} style={[styles.inlineCode, { backgroundColor: mono.surfaceMuted, color: mono.text }]}>
            {part.value}
          </Text>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        )
      )}
    </>
  );
}

/**
 * 渲染 MD 导入的学习内容（content_topic_items）。
 * 结构与 Web 侧 `<MarkdownLite>` 一致：解析下沉到 @learn-workbench/shared，
 * 两端只用原生节点渲染，不注入 HTML。
 */
export function MarkdownLite({ markdown, colors }: { markdown: string; colors: ThemeColors }) {
  const styles2 = useMemo(() => makeStyles(colors), [colors]);
  const blocks = useMemo(() => parseMarkdownLite(markdown), [markdown]);
  if (blocks.length === 0) return null;
  return (
    <View style={styles2.wrap}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} colors={colors} styles2={styles2} />
      ))}
    </View>
  );
}

function BlockView({
  block,
  colors,
  styles2,
}: {
  block: MdBlock;
  colors: ThemeColors;
  styles2: ReturnType<typeof makeStyles>;
}) {
  switch (block.type) {
    case "heading":
      return (
        <Text style={[styles2.heading, block.level <= 1 && styles2.heading1]}>
          <Inline text={block.text} mono={colors} />
        </Text>
      );
    case "code":
      return (
        <View style={styles2.codeCard}>
          <Text selectable style={styles2.code}>
            {block.code}
          </Text>
        </View>
      );
    case "list":
      return (
        <View style={styles2.list}>
          {block.items.map((item, index) => (
            <View key={index} style={styles2.listRow}>
              <Text style={styles2.bullet}>{block.ordered ? `${index + 1}.` : "•"}</Text>
              <Text style={styles2.listText}>
                <Inline text={item} mono={colors} />
              </Text>
            </View>
          ))}
        </View>
      );
    case "quote":
      return (
        <View style={styles2.quote}>
          <Text style={styles2.quoteText}>
            <Inline text={block.text} mono={colors} />
          </Text>
        </View>
      );
    case "paragraph":
      return (
        <Text style={styles2.paragraph}>
          <Inline text={block.text} mono={colors} />
        </Text>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  inlineCode: {
    fontFamily: MONO,
    fontSize: typography.caption.fontSize,
  },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    heading: { ...typography.caption, fontWeight: "800", color: colors.textSecondary },
    heading1: { ...typography.callout, fontWeight: "800", color: colors.text },
    codeCard: {
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      padding: 10,
    },
    code: { fontFamily: MONO, fontSize: typography.caption.fontSize, lineHeight: 18, color: colors.text },
    list: { gap: 4 },
    listRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    bullet: { ...typography.caption, color: colors.textMuted, minWidth: 12 },
    listText: { flex: 1, ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
    quote: {
      borderLeftWidth: 2,
      borderLeftColor: colors.borderStrong,
      paddingLeft: 10,
    },
    quoteText: { ...typography.caption, fontStyle: "italic", color: colors.textMuted },
    paragraph: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  });
