import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { SvgXml } from "react-native-svg";
import { sanitizeSvgForNative } from "@/lib/svg-sanitize";
import { KnowledgeMap } from "@/components/knowledge-map";
import { ThemedIcon } from "@/components/themed-icon";
import type { Exam408KnowledgeMap } from "@/lib/exam-408-map";
import {
  chunkInlineText,
  parseStudyInline,
  studyInlinePlain,
  studySegmentsPlain,
  studyTableColumnWidths,
  resolveStudyAssetUrl,
  studyImageKind,
  type StudyBlock,
  type StudyInline,
  type StudySegment,
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
  /**
   * 章节知识图谱（v1.55）：cs408 正文里的 knowledge-map iframe 不再显示占位/外链，
   * 由阅读页按文章 slug 取数后传进来，这里负责渲染原生 SVG。
   */
  knowledgeMap?: Exam408KnowledgeMap | null;
  knowledgeMapLoading?: boolean;
  knowledgeMapError?: string;
  onKnowledgeMapRetry?: () => void;
}

export function MarkdownArticle({
  blocks,
  assetBaseUrl,
  onHeadingLayout,
  onArticleLayout,
  knowledgeMap,
  knowledgeMapLoading,
  knowledgeMapError,
  onKnowledgeMapRetry,
}: MarkdownArticleProps): React.JSX.Element {
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
                {/* v2.2：标题同样可能带 **粗体**、`代码`、$O(n)$（cs408 有 50 处），统一走行内 token */}
                <InlineTokens tokens={parseStudyInline(block.text)} />
              </Text>
            );
          }
          case "paragraph":
            return block.segments && block.segments.length > 0 ? (
              <SegmentRow key={key} segments={block.segments} style={styles.paragraph} />
            ) : (
              <InlineText key={key} tokens={block.inlines} style={styles.paragraph} />
            );
          case "list":
            return (
              <View key={key} style={styles.list}>
                {block.items.map((item, itemIndex) => (
                  <View key={key + "-" + itemIndex} style={[styles.listItem, { marginLeft: item.depth * spacing.lg }]}>
                    <Text style={styles.bullet}>{block.ordered ? itemIndex + 1 + "." : "•"}</Text>
                    {item.segments && item.segments.length > 0 ? (
                      <InlineSegments segments={item.segments} style={styles.listText} />
                    ) : (
                      <InlineText tokens={item.inlines} style={styles.listText} />
                    )}
                  </View>
                ))}
              </View>
            );
          case "quote":
            return (
              <View key={key} style={styles.quote}>
                {block.lines.map((line, lineIndex) => {
                  const segments = block.lineSegments?.[lineIndex];
                  return segments && segments.length > 0 ? (
                    <InlineSegments key={key + "-" + lineIndex} segments={segments} style={styles.quoteText} />
                  ) : (
                    <InlineText key={key + "-" + lineIndex} tokens={line} style={styles.quoteText} />
                  );
                })}
              </View>
            );
          case "table":
            return <TableView key={key} block={block} />;
          case "code":
            return (
              <View key={key} style={styles.codeBlock}>
                <View style={styles.blockHead}>
                  <Text style={styles.codeLang}>{block.lang ? block.lang.toUpperCase() : "CODE"}</Text>
                  <CopyButton value={block.code} label="复制代码" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeScroll}>
                  <Text style={styles.codeText} selectable>
                    {block.code}
                  </Text>
                </ScrollView>
              </View>
            );
          case "math":
            // v1.55 / P7：接口带 ?format=svg 时服务端已把公式渲染成自包含 SVG，直接画出来；
            // 旧接口/渲染失败时回退到等宽 LaTeX（可复制到外部工具查看）。
            if (block.svg) {
              return (
                <View key={key} style={styles.mathSvgBlock}>
                  <MathSvg svg={block.svg} display />
                  <View style={styles.mathSvgFoot}>
                    <CopyButton value={block.tex} label="复制 LaTeX" />
                  </View>
                </View>
              );
            }
            return (
              <View key={key} style={styles.mathBlock}>
                <View style={styles.blockHead}>
                  <Text style={styles.mathLabel}>LaTeX 公式 · 服务端未渲染</Text>
                  <CopyButton value={block.tex} label="复制公式" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeScroll}>
                  <Text style={styles.mathText} selectable>
                    {block.tex}
                  </Text>
                </ScrollView>
                <Text style={styles.mathHint}>可复制到支持 LaTeX 的工具查看。</Text>
              </View>
            );
          case "image":
            // key 带 src：换文章/换图时组件重挂载，加载态与宽高比自然重置（避免在 effect 里同步 setState）
            return <StudyImage key={key + "-" + block.src} src={block.src} alt={block.alt} assetBaseUrl={assetBaseUrl} />;
          case "embed": {
            // 「📊 章节知识图谱」：原生自绘，不再出现「去原文查看」外链
            if (/knowledge-map/i.test(block.src)) {
              return (
                <KnowledgeMap
                  key={key}
                  map={knowledgeMap ?? null}
                  loading={knowledgeMapLoading}
                  error={knowledgeMapError}
                  onRetry={onKnowledgeMapRetry}
                />
              );
            }
            return <EmbedNotice key={key} src={block.src} title={block.title} assetBaseUrl={assetBaseUrl} />;
          }
          case "divider":
            return <View key={key} style={styles.divider} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

/** 从 SVG 根节点读 viewBox（1 单位 = 1/1000 em），解析失败给兜底尺寸 */
function readMathViewBox(svg: string): { width: number; height: number } {
  const match = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(String(svg ?? ""));
  const width = Number(match?.[1] ?? 0);
  const height = Number(match?.[2] ?? 0);
  return width > 0 && height > 0 ? { width, height } : { width: 1000, height: 500 };
}

/**
 * 服务端 TeX→SVG 的公式（P7）。尺寸换算：MathJax viewBox 的单位是 1/1000 em，
 * 所以 px = 单位/1000 × 字号；行内公式再限高（避免分式把行高撑开），显示公式限宽于窗口。
 * 颜色统一用主题正文色（MathJax 输出里是 currentColor，RN 不认，必须替换成实色）。
 */
function MathSvg({ svg, display }: { svg: string; display?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const box = useMemo(() => readMathViewBox(svg), [svg]);
  // P13：服务端 TeX→SVG 与 cs408 插图 SVG 都必须清洗后再交给 SvgXml（pointer-events=all 会原生 FATAL）
  const xml = useMemo(
    () => sanitizeSvgForNative(svg.replace(/currentColor/g, colors.text).replace(/\sdata-[a-z-]+="[^"]*"/g, "")),
    [svg, colors.text],
  );
  const fontSize = display ? 17 : 15;
  let renderWidth = (box.width / 1000) * fontSize;
  let renderHeight = (box.height / 1000) * fontSize;
  const heightCap = fontSize * 1.8;
  if (renderHeight > heightCap) {
    const factor = heightCap / renderHeight;
    renderWidth *= factor;
    renderHeight *= factor;
  }
  const widthCap = Math.max(180, windowWidth - spacing.lg * 4 - spacing.md * 4);
  if (renderWidth > widthCap) {
    const factor = widthCap / renderWidth;
    renderWidth *= factor;
    renderHeight *= factor;
  }
  return (
    <View style={display ? styles.mathSvgDisplay : styles.mathSvgInline}>
      <SvgXml xml={xml} width={renderWidth} height={renderHeight} />
    </View>
  );
}

/**
 * 带行内公式的段落：RN 的 Text 里不能嵌 SvgXml，所以拆成 flexWrap 的行内块
 * （文本按 ~14 字切块给折行留机会；公式渲染成小 SVG，失败回退等宽 LaTeX）。
 *
 * v2.2：段类型扩展出 strong / code —— 服务端 text 段里的 **粗体** 与 `代码`
 * 已在 normalizeStudySegments 里切好（粗体跨公式/套代码也能正确成型），
 * 这里按段渲染真粗体与等宽底色，正文不再出现字面量符号。
 */
function SegmentRow({ segments, style }: { segments: StudySegment[]; style: object }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const parts = useMemo(() => {
    const items: (
      | { kind: "text"; key: string; text: string }
      | { kind: "strong"; key: string; text: string }
      | { kind: "code"; key: string; text: string }
      | { kind: "math"; key: string; tex: string; svg: string | null }
    )[] = [];
    segments.forEach((segment, index) => {
      if (segment.type === "math") {
        items.push({ kind: "math", key: "m-" + index, tex: segment.tex, svg: segment.svg });
        return;
      }
      const text = segment.type === "text" ? segment.text : segment.value;
      chunkInlineText(text).forEach((chunk, chunkIndex) => {
        items.push({
          kind: segment.type,
          key: segment.type[0] + "-" + index + "-" + chunkIndex,
          text: chunk,
        });
      });
    });
    return items;
  }, [segments]);
  return (
    <View style={styles.segmentRow}>
      {parts.map((part) =>
        part.kind === "math" ? (
          part.svg ? (
            <MathSvg key={part.key} svg={part.svg} />
          ) : (
            <Text key={part.key} style={styles.inlineMath}>
              {part.tex}
            </Text>
          )
        ) : (
          <Text
            key={part.key}
            style={[
              style,
              part.kind === "strong" ? styles.strong : part.kind === "code" ? styles.inlineCode : null,
            ]}
            selectable
          >
            {part.text}
          </Text>
        ),
      )}
    </View>
  );
}

/**
 * 行内段（表格 / 列表 / 引用专用）：所有段塞进同一个 Text，用嵌套 Text 保留行内流式排版。
 *
 * 为什么不再用 SegmentRow 的 flexWrap：flex 子项会各自成为独立盒子，在窄表格单元格
 * 里换行时粗体/正文被拆成左右两列、逐字竖排（v2.2 真机反馈）。这里改为单一 Text +
 * 嵌套 Text，文字按正常行内流排版；公式段退化为等宽 tex（SVG 不能嵌进 Text）。
 */
function InlineSegments({ segments, style }: { segments: StudySegment[]; style: object }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Text style={[style]} selectable>
      {segments.map((segment, index) => {
        if (segment.type === "math") {
          return (
            <Text key={"m-" + index} style={styles.inlineMath}>
              {segment.tex}
            </Text>
          );
        }
        if (segment.type === "strong") {
          return (
            <Text key={"s-" + index} style={styles.strong}>
              {segment.value}
            </Text>
          );
        }
        if (segment.type === "code") {
          return (
            <Text key={"c-" + index} style={styles.inlineCode}>
              {segment.value}
            </Text>
          );
        }
        return <Text key={"t-" + index}>{segment.text}</Text>;
      })}
    </Text>
  );
}

/** 行内 token 内容：加粗 / 行内代码 / 公式 / 纯文本，全部走嵌套 Text（不注入 HTML） */
function InlineTokens({ tokens }: { tokens: StudyInline[] }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <>
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
    </>
  );
}

/** 行内 token：加粗 / 行内代码 / 公式 / 纯文本，全部走嵌套 Text（不注入 HTML） */
function InlineText({ tokens, style }: { tokens: StudyInline[]; style: object }): React.JSX.Element {
  return (
    <Text style={style} selectable>
      <InlineTokens tokens={tokens} />
    </Text>
  );
}

function TableView({ block }: { block: Extract<StudyBlock, { type: "table" }> }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const columnCount = Math.max(block.header.length, ...block.rows.map((row) => row.length), 1);
  // v2.2.2：表头与所有数据行共用同一组列宽（按全表最长内容估算），否则各行宽度不同导致列错位
  const columnWidths = useMemo(() => {
    const headerTexts = Array.from({ length: columnCount }).map((_, column) => {
      const segments = block.headerSegments?.[column];
      return segments && segments.length > 0 ? studySegmentsPlain(segments) : studyInlinePlain(block.header[column]);
    });
    const rowTexts = block.rows.map((row, rowIndex) =>
      Array.from({ length: columnCount }).map((_, column) => {
        const segments = block.rowSegments?.[rowIndex]?.[column];
        return segments && segments.length > 0 ? studySegmentsPlain(segments) : studyInlinePlain(row[column]);
      }),
    );
    return studyTableColumnWidths(headerTexts, rowTexts, columnCount);
  }, [block, columnCount]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          {Array.from({ length: columnCount }).map((_, column) => (
            <View key={"h-" + column} style={[styles.tableCell, { width: columnWidths[column] }]}>
              {block.headerSegments?.[column] && block.headerSegments[column].length > 0 ? (
                <InlineSegments segments={block.headerSegments[column]} style={styles.tableHeaderText} />
              ) : (
                <InlineText tokens={block.header[column] ?? []} style={styles.tableHeaderText} />
              )}
            </View>
          ))}
        </View>
        {block.rows.map((row, rowIndex) => (
          <View key={"r-" + rowIndex} style={styles.tableRow}>
            {Array.from({ length: columnCount }).map((_, column) => (
              <View key={"c-" + rowIndex + "-" + column} style={[styles.tableCell, { width: columnWidths[column] }]}>
                {block.rowSegments?.[rowIndex]?.[column] && block.rowSegments[rowIndex][column].length > 0 ? (
                  <InlineSegments segments={block.rowSegments[rowIndex][column]} style={styles.tableCellText} />
                ) : (
                  <InlineText tokens={row[column] ?? []} style={styles.tableCellText} />
                )}
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
          <SvgXml xml={sanitizeSvgForNative(xml)} width="100%" height="100%" />
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

/** 代码 / 公式块的复制按钮：expo-clipboard 是既有依赖，不新增包，也不引 WebView。 */
function CopyButton({ value, label }: { value: string; label: string }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = () => {
    void Clipboard.setStringAsync(value)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // 剪贴板不可用：文本本身可长按选择，不影响阅读
      });
  };
  return (
    <Pressable
      onPress={copy}
      style={styles.copyButton}
      accessibilityRole="button"
      accessibilityLabel={copied ? "已复制" : label}
    >
      <ThemedIcon
        ios={copied ? "checkmark" : "doc.on.doc"}
        name={copied ? "checkmark" : "copy-outline"}
        size={12}
        color={copied ? colors.success : colors.textMuted}
      />
      <Text style={[styles.copyText, copied ? { color: colors.success } : null]}>
        {copied ? "已复制" : label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // v1.55 排版微调：正文列最大宽度 720（平板/横屏不再拉成一行 100+ 字），块间距加一档
    article: { width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.lg },
    firstBlock: { marginTop: 0 },
    paragraph: { ...typography.body, color: colors.textSecondary, lineHeight: 28 },
    strong: { fontWeight: "700", color: colors.text },
    inlineCode: {
      fontFamily: MONO,
      fontSize: 14,
      color: colors.primaryStrong,
      backgroundColor: colors.surfaceMuted,
    },
    inlineMath: { fontFamily: MONO, fontSize: 14, color: colors.primary },
    segmentRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
    mathSvgInline: { marginHorizontal: 1 },
    mathSvgDisplay: { alignItems: "center", paddingVertical: spacing.xs },
    mathSvgBlock: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      gap: spacing.xs,
    },
    mathSvgFoot: { flexDirection: "row", justifyContent: "flex-end", alignSelf: "stretch" },
    h1: { ...typography.title1, color: colors.text, marginTop: spacing.lg },
    h2: { ...typography.title2, color: colors.text, marginTop: spacing.lg },
    h3: { ...typography.headline, color: colors.text, marginTop: spacing.md },
    h4: { ...typography.callout, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
    list: { gap: spacing.sm },
    listItem: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
    bullet: { ...typography.body, color: colors.primary, minWidth: 16 },
    listText: { ...typography.body, color: colors.textSecondary, flex: 1, lineHeight: 27 },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      backgroundColor: colors.accentSoft,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
    },
    quoteText: { ...typography.callout, color: colors.textSecondary, lineHeight: 24 },
    codeScroll: { flexGrow: 0 },
    codeBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    codeBlock: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    codeLang: { ...typography.micro, color: colors.textFaint, textTransform: "uppercase" },
    codeText: { fontFamily: MONO, fontSize: 13, lineHeight: 20, color: colors.text },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    copyText: { ...typography.micro, color: colors.textMuted },
    mathBlock: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    mathLabel: { ...typography.micro, color: colors.primaryStrong },
    mathHint: { ...typography.micro, color: colors.textMuted },
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
    // 列宽由 studyTableColumnWidths 统一计算（表头与数据行共用），这里只负责内边距
    tableCell: {
      flexShrink: 0,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      justifyContent: "center",
    },
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