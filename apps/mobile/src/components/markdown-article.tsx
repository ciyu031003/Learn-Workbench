import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SvgXml } from "react-native-svg";
import { ThemedIcon } from "@/components/themed-icon";
import {
  resolveStudyAssetUrl,
  studyImageKind,
  type StudyBlock,
  type StudyInline,
} from "@/lib/exam-408-study";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 408 精读正文渲染器（v1.55）：把 parseStudyMarkdown 产出的结构块用 RN 原生节点渲染。
 *
 * 三条设计约束：
 * 1. 零 HTML 注入：正文里的尖括号是数学记号（reg、i,j 之类），只认结构块，不认标签；
 * 2. SVG 先取文本再渲染：cs408 的插图 840 张全是 SVG，react-native-svg 的 SvgXml 需要
 *    拿到 xml 字符串，因此按需 fetch 文本；失败降级为可点链接（不能让读者看到白块）；
 * 3. 不内嵌滚动容器：本组件只输出块，滚动交给阅读页的 ScrollView，
 *    这样目录跳转（scrollTo）与阅读进度才能作用于同一容器。
 */

const MONO = "monospace";

export interface MarkdownArticleProps {
  blocks: StudyBlock[];
  /** 资源基址（getApiUrl()），用于把 /content-images/... 拼成绝对地址 */
  assetBaseUrl: string;
  /** 标题布局回调：y 是相对正文顶部的偏移（阅读页需再加上 onArticleLayout 给的文章顶部偏移） */
  onHeadingLayout?: (id: string, y: number) => void;
  /** 正文根节点在滚动容器里的 y（目录跳转要把它加到标题偏移上） */
  onArticleLayout?: (y: number) => void;
}

export function MarkdownArticle({ blocks, assetBaseUrl, onHeadingLayout, onArticleLayout }: MarkdownArticleProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View
      style={styles.article}
      onLayout={(event) => onArticleLayout?.(event.nativeEvent.layout.y)}
    >
      {blocks.map((block, index) => {
        const key = block.type + "-" + index;
        switch (block.type) {
          case "heading": {
            const headingStyle =
              block.level <= 1
                ? styles.h1
                : block.level === 2
                  ? styles.h2
                  : block.level === 3
                    ? styles.h3
                    : styles.h4;
            return (
              <Text
                key={key}
                style={[headingStyle, index === 0 ? styles.firstBlock : null]}
                onLayout={(event) => onHeadingLayout?.(block.id, event.nativeEvent.layout.y)}
                accessibilityRole="header"
              >
                {block.text}
              </Text>
            );
          }
          case "paragraph":
            return <InlineText key={key} tokens={block.inlines} style={styles.paragraph} />;
          case "list":
            return (
              <View key={key} style={styles.list}>
                {block.items.map((item, itemIndex) => (
                  <View key={key + "-" + itemIndex} style={[styles.listItem, { marginLeft: item.depth * spacing.lg }]}>
                    <Text style={styles.bullet}>{block.ordered ? itemIndex + 1 + "." : "•"}</Text>
                    <InlineText tokens={item.inlines} style={styles.listText} />
                  </View>
                ))}
              </View>
            );
          case "quote":
            return (
              <View key={key} style={styles.quote}>
                {block.lines.map((line, lineIndex) => (
                  <InlineText key={key + "-" + lineIndex} tokens={line} style={styles.quoteText} />
                ))}
              </View>
            );
          case "table":
            return <TableView key={key} block={block} />;
          case "code":
            return (
              <ScrollView key={key} horizontal showsHorizontalScrollIndicator={false} style={styles.codeScroll}>
                <View style={styles.codeBox}>
                  {block.lang ? <Text style={styles.codeLang}>{block.lang}</Text> : null}
                  <Text style={styles.codeText}>{block.code}</Text>
                </View>
              </ScrollView>
            );
          case "math":
            return (
              <ScrollView key={key} horizontal showsHorizontalScrollIndicator={false} style={styles.codeScroll}>
                <View style={styles.mathBox}>
                  <Text style={styles.mathText}>{block.tex}</Text>
                </View>
              </ScrollView>
            );
          case "image":
            // key 带 src：换文章/换图时组件重挂载，加载态与宽高比自然重置（避免在 effect 里同步 setState）
            return <StudyImage key={key + "-" + block.src} src={block.src} alt={block.alt} assetBaseUrl={assetBaseUrl} />;
          case "embed":
            return <EmbedNotice key={key} src={block.src} title={block.title} assetBaseUrl={assetBaseUrl} />;
          case "divider":
            return <View key={key} style={styles.divider} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

/** 行内 token：加粗 / 行内代码 / 公式 / 纯文本，全部走嵌套 Text（不注入 HTML） */
function InlineText({ tokens, style }: { tokens: StudyInline[]; style: object }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Text style={style} selectable>
      {tokens.map((token, index) => {
        if (token.type === "strong") {
          return (
            <Text key={index} style={styles.strong}>
              {token.value}
            </Text>
          );
        }
        if (token.type === "code") {
          return (
            <Text key={index} style={styles.inlineCode}>
              {token.value}
            </Text>
          );
        }
        if (token.type === "math") {
          return (
            <Text key={index} style={styles.inlineMath}>
              {token.value}
            </Text>
          );
        }
        return <Text key={index}>{token.value}</Text>;
      })}
    </Text>
  );
}

function TableView({ block }: { block: Extract<StudyBlock, { type: "table" }> }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const columnCount = Math.max(block.header.length, ...block.rows.map((row) => row.length), 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          {Array.from({ length: columnCount }).map((_, column) => (
            <View key={"h-" + column} style={[styles.tableCell, { minWidth: 96 }]}>
              <InlineText tokens={block.header[column] ?? []} style={styles.tableHeaderText} />
            </View>
          ))}
        </View>
        {block.rows.map((row, rowIndex) => (
          <View key={"r-" + rowIndex} style={styles.tableRow}>
            {Array.from({ length: columnCount }).map((_, column) => (
              <View key={"c-" + rowIndex + "-" + column} style={[styles.tableCell, { minWidth: 96 }]}>
                <InlineText tokens={row[column] ?? []} style={styles.tableCellText} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * 插图：SVG 走 SvgXml（先取文本、按 viewBox 定宽高比），位图走 expo-image；
 * 加载失败统一降级为「点此在浏览器打开」的可点行，不让读者卡在白块。
 */
function StudyImage({ src, alt, assetBaseUrl }: { src: string; alt: string; assetBaseUrl: string }): React.JSX.Element | null {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const uri = useMemo(() => resolveStudyAssetUrl(src, assetBaseUrl), [src, assetBaseUrl]);
  const kind = studyImageKind(src);
  const [xml, setXml] = useState("");
  const [ratio, setRatio] = useState(0.62);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (kind !== "svg" || !uri) return;
    let cancelled = false;
    fetch(uri)
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      })
      .then((text) => {
        if (cancelled) return;
        if (!/<svg[\s>]/i.test(text)) throw new Error("not svg");
        const viewBox = /viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(text);
        if (viewBox) {
          const width = Number(viewBox[1]);
          const height = Number(viewBox[2]);
          if (width > 0 && height > 0) setRatio(Math.min(3, Math.max(0.2, height / width)));
        }
        setXml(text);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, uri]);

  if (!uri) return null;

  if (failed) {
    return <AssetFallback uri={uri} label={alt} styles={styles} colors={colors} />;
  }

  if (kind === "svg" && !xml) {
    return (
      <View style={[styles.imageFrame, { aspectRatio: 1 / ratio }]}>
        <Text style={styles.imageHint}>插图加载中…</Text>
      </View>
    );
  }

  return (
    <View style={styles.imageWrap}>
      <View style={[styles.imageFrame, { aspectRatio: 1 / ratio }]}>
        {kind === "svg" ? (
          <SvgXml xml={xml} width="100%" height="100%" />
        ) : (
          <Image
            source={{ uri }}
            style={styles.rasterImage}
            contentFit="contain"
            transition={120}
            onLoad={(event) => {
              const width = Number((event as unknown as { source?: { width?: number } })?.source?.width ?? 0);
              const height = Number((event as unknown as { source?: { height?: number } })?.source?.height ?? 0);
              if (width > 0 && height > 0) setRatio(Math.min(3, Math.max(0.2, height / width)));
            }}
            onError={() => setFailed(true)}
          />
        )}
      </View>
      {alt ? <Text style={styles.imageCaption}>{alt}</Text> : null}
    </View>
  );
}

function AssetFallback({
  uri,
  label,
  styles,
  colors,
}: {
  uri: string;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(uri).catch(() => undefined);
      }}
      style={styles.imageFallback}
    >
      <ThemedIcon name="image-outline" size={18} color={colors.textMuted} />
      <Text style={styles.imageFallbackText} numberOfLines={2}>
        {label ? label + " · " : ""}插图无法内嵌，点此在浏览器打开
      </Text>
    </Pressable>
  );
}

function EmbedNotice({
  src,
  title,
  assetBaseUrl,
}: {
  src: string;
  title: string;
  assetBaseUrl: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.embed}>
      <ThemedIcon name="git-network-outline" size={18} color={colors.primary} />
      <View style={styles.embedBody}>
        <Text style={styles.embedTitle}>{title || "交互知识图谱"}</Text>
        <Text style={styles.embedText}>该图谱是可交互网页，App 内以文字版讲义为准；完整交互可在 Web 端 408 精读页查看。</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL(resolveStudyAssetUrl(src, assetBaseUrl)).catch(() => undefined);
          }}
        >
          <Text style={styles.embedLink}>打开交互图谱</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    article: { gap: spacing.md },
    firstBlock: { marginTop: 0 },
    paragraph: { ...typography.body, color: colors.textSecondary, lineHeight: 27 },
    strong: { fontWeight: "700", color: colors.text },
    inlineCode: {
      fontFamily: MONO,
      fontSize: 14,
      color: colors.primaryStrong,
      backgroundColor: colors.surfaceMuted,
    },
    inlineMath: { fontFamily: MONO, fontSize: 14, color: colors.primary },
    h1: { ...typography.title1, color: colors.text, marginTop: spacing.lg },
    h2: { ...typography.title2, color: colors.text, marginTop: spacing.lg },
    h3: { ...typography.headline, color: colors.text, marginTop: spacing.md },
    h4: { ...typography.callout, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
    list: { gap: spacing.sm },
    listItem: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
    bullet: { ...typography.body, color: colors.primary, minWidth: 16 },
    listText: { ...typography.body, color: colors.textSecondary, flex: 1, lineHeight: 26 },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      backgroundColor: colors.accentSoft,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
    },
    quoteText: { ...typography.callout, color: colors.textSecondary, lineHeight: 23 },
    codeScroll: { flexGrow: 0 },
    codeBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    codeLang: { ...typography.micro, color: colors.textFaint, textTransform: "uppercase" },
    codeText: { fontFamily: MONO, fontSize: 13, lineHeight: 20, color: colors.text },
    mathBox: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    mathText: { fontFamily: MONO, fontSize: 14, lineHeight: 22, color: colors.primaryStrong },
    tableScroll: { flexGrow: 0 },
    table: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.sm,
      overflow: "hidden",
    },
    tableRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    tableHeaderRow: { backgroundColor: colors.surfaceMuted },
    tableCell: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, justifyContent: "center" },
    tableHeaderText: { ...typography.caption, fontWeight: "700", color: colors.text },
    tableCellText: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
    imageWrap: { gap: spacing.xs },
    imageFrame: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
      alignItems: "stretch",
      justifyContent: "center",
    },
    imageHint: { ...typography.caption, color: colors.textFaint, textAlign: "center" },
    rasterImage: { width: "100%", height: "100%" },
    imageCaption: { ...typography.caption, color: colors.textFaint, textAlign: "center" },
    imageFallback: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    imageFallbackText: { ...typography.caption, color: colors.textMuted, flex: 1 },
    embed: {
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
    },
    embedBody: { flex: 1, gap: 4 },
    embedTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    embedText: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
    embedLink: { ...typography.caption, fontWeight: "700", color: colors.primary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  });
