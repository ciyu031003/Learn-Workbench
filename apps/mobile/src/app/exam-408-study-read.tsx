import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MarkdownArticle } from "@/components/markdown-article";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { getApiUrl } from "@/config";
import { getExam408KnowledgeMap, type Exam408KnowledgeMap } from "@/lib/exam-408-map";
import {
  buildStudyToc,
  exam408StudyImportanceLabel,
  exam408StudySubjectTitle,
  getExam408StudyArticle,
  parseStudyMarkdown,
  type Exam408StudyDetail,
} from "@/lib/exam-408-study";
import { takeNavPendingParams } from "@/lib/nav-pending";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

const NAV_CHANNEL = "exam-408-study-read";

/**
 * 408 精读·阅读页（v1.55）：一屏一节，顶部吸顶标题 + 目录抽屉 + 正文 + 上一节/下一节 + 来源。
 *
 * 为什么「一屏一节」而不是把所有文章串成一个长列表：cs408 的 181 篇是按知识点切分的独立
 * 讲义（每篇 2~15 屏），通勤场景需要「点开就读完一节、随时退出」，而长列表会把阅读进度、
 * 目录、上下节导航全部压平。这里一篇 = 一个屏，上一节/下一节在同一屏内切换（不反复压栈）。
 */
export default function Exam408StudyReadScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const paramSlug = params.slug?.trim() ?? "";
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const scrollRef = useRef<ScrollView>(null);
  const [slug, setSlug] = useState(paramSlug);
  const [detail, setDetail] = useState<Exam408StudyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  /** 📊 章节知识图谱文章的原生图谱数据（非图谱文章为 null） */
  const [knowledgeMap, setKnowledgeMap] = useState<Exam408KnowledgeMap | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const headingY = useRef<Record<string, number>>({});
  /** 正文根节点在滚动内容里的偏移：标题 y 是相对正文的，跳转要加上它 */
  const articleY = useRef(0);
  const lastLoad = useRef({ slug: "", at: 0 });
  const assetBaseUrl = useMemo(() => getApiUrl(), []);

  const load = useCallback(async (nextSlug: string, options?: { keepScroll?: boolean }) => {
    const target = nextSlug.trim();
    if (!target) {
      setError("缺少文章参数");
      setLoading(false);
      return;
    }
    const now = Date.now();
    if (target === lastLoad.current.slug && now - lastLoad.current.at < 400) return;
    lastLoad.current = { slug: target, at: now };
    setLoading(true);
    setError("");
    headingY.current = {};
    setKnowledgeMap(null);
    setMapError("");
    setMapLoading(false);
    try {
      const next = await getExam408StudyArticle(target);
      setDetail(next);
      setSlug(target);
      if (!options?.keepScroll) {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
      // 「📊 章节知识图谱」文章：正文里是 knowledge-map iframe，这里取原生图谱数据交给渲染器
      if (/knowledge-map/i.test(next.article.slug)) {
        setMapLoading(true);
        try {
          const map = await getExam408KnowledgeMap(next.article.slug);
          setKnowledgeMap(map);
          setMapError(map ? "" : "本章知识图谱暂未同步");
        } catch (mapReason) {
          setMapError(mapReason instanceof Error ? mapReason.message : "知识图谱加载失败");
        } finally {
          setMapLoading(false);
        }
      }
    } catch (reason) {
      setDetail(null);
      setError(reason instanceof Error ? reason.message : "正文加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const pending = takeNavPendingParams(NAV_CHANNEL)?.slug ?? "";
      void load(pending || paramSlug);
    }, [load, paramSlug]),
  );

  const blocks = useMemo(() => {
    // 优先用服务端 blocks（?format=svg：带 segments 与 math.svg 的公式排版）；
    // 旧接口/离线时回退到本地 Markdown 解析（公式退化为等宽 LaTeX）。
    const serverBlocks = detail?.blocks ?? [];
    const parsed = serverBlocks.length > 0 ? serverBlocks : parseStudyMarkdown(detail?.article.contentMd ?? "");
    // cs408 每篇正文的第一个一级标题就是文章标题，而 hero 已经渲染过；重复渲染会显得啰嗦
    const first = parsed[0];
    const title = (detail?.article.title ?? "").trim();
    if (first && first.type === "heading" && first.level === 1 && title && first.text.trim() === title) {
      return parsed.slice(1);
    }
    return parsed;
  }, [detail]);
  const toc = useMemo(() => buildStudyToc(blocks), [blocks]);
  const minutes = useMemo(() => {
    const characters = (detail?.article.contentMd ?? "").replace(/\s+/g, "").length;
    return Math.max(1, Math.round(characters / 420));
  }, [detail]);

  const jumpToHeading = (id: string) => {
    const y = headingY.current[id];
    setTocOpen(false);
    if (typeof y !== "number") return;
    // 等抽屉关闭动画先跑完，否则 scrollTo 会被 Modal 的关闭动画吃掉
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, articleY.current + y - 12), animated: true });
    }, 160);
  };

  const goSibling = (nextSlug: string | undefined) => {
    if (!nextSlug) return;
    void load(nextSlug);
  };

  if (loading && !detail) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>正在加载精读正文…</Text>
      </View>
    );
  }

  if (error && !detail) {
    return (
      <View style={styles.centerState}>
        <ThemedIcon name="alert-circle-outline" size={26} color={colors.danger} />
        <Text style={styles.centerTitle}>正文加载失败</Text>
        <Text style={styles.centerText}>{error}</Text>
        <PressableScale haptic onPress={() => void load(slug)} style={styles.retry}>
          <Text style={styles.retryText}>重试</Text>
        </PressableScale>
        <PressableScale haptic onPress={() => router.back()} style={styles.retry}>
          <Text style={styles.retryText}>返回目录</Text>
        </PressableScale>
      </View>
    );
  }

  const article = detail?.article;
  if (!article) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.centerText}>没有找到这篇精读。</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar
        title={article.title}
        backTo={"/exam-408-study?subject=" + article.subjectKey}
        right={
          <Pressable
            hitSlop={8}
            onPress={() => setTocOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="打开目录"
            style={styles.tocButton}
          >
            <ThemedIcon name="list-outline" size={20} color={colors.text} />
          </Pressable>
        }
      />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroBreadcrumb} numberOfLines={1}>
            {exam408StudySubjectTitle(article.subjectKey)}
            {article.chapter ? " · " + article.chapter : ""}
          </Text>
          <Text style={styles.heroTitle}>{article.title}</Text>
          <View style={styles.heroMeta}>
            <View style={[styles.badge, article.importance === "must" ? styles.badgeMust : styles.badgeCommon]}>
              <Text style={[styles.badgeText, article.importance === "must" ? styles.badgeTextMust : styles.badgeTextCommon]}>
                {exam408StudyImportanceLabel(article.importance)}
              </Text>
            </View>
            <Text style={styles.heroMetaText}>
              {article.examFrequency > 0 ? "真题命中 " + article.examFrequency + " 次" : "统计未命中"}
            </Text>
            <Text style={styles.heroMetaText}>约 {minutes} 分钟</Text>
          </View>
        </View>

        <MarkdownArticle
          blocks={blocks}
          assetBaseUrl={assetBaseUrl}
          onHeadingLayout={(id, y) => {
            headingY.current[id] = y;
          }}
          onArticleLayout={(y) => {
            articleY.current = y;
          }}
          knowledgeMap={knowledgeMap}
          knowledgeMapLoading={mapLoading}
          knowledgeMapError={mapError}
          onKnowledgeMapRetry={() => void load(slug, { keepScroll: true })}
        />

        <View style={styles.pager}>
          {detail?.prev ? (
            <PressableScale haptic scaleTo={0.99} onPress={() => goSibling(detail.prev?.slug)} style={styles.pagerRow}>
              <ThemedIcon name="arrow-back" size={16} color={colors.primary} />
              <View style={styles.pagerBody}>
                <Text style={styles.pagerLabel}>上一节</Text>
                <Text style={styles.pagerTitle} numberOfLines={2}>
                  {detail.prev.title}
                </Text>
              </View>
            </PressableScale>
          ) : null}
          {detail?.next ? (
            <PressableScale haptic scaleTo={0.99} onPress={() => goSibling(detail.next?.slug)} style={styles.pagerRow}>
              <View style={styles.pagerBody}>
                <Text style={styles.pagerLabel}>下一节</Text>
                <Text style={styles.pagerTitle} numberOfLines={2}>
                  {detail.next.title}
                </Text>
              </View>
              <ThemedIcon name="arrow-forward" size={16} color={colors.primary} />
            </PressableScale>
          ) : null}
        </View>

        <View style={styles.sourceBox}>
          <Text style={styles.sourceTitle}>来源</Text>
          <Text style={styles.sourceText}>
            本文镜像自 cs408.cloud「知识精读」（作者授权个人学习、非商业用途）。保留署名与原文链接，如发现内容问题以原文为准。
          </Text>
          {article.sourceUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                void Linking.openURL(article.sourceUrl ?? "").catch(() => undefined);
              }}
            >
              <Text style={styles.sourceLink}>查看原文</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={tocOpen} transparent animationType="fade" onRequestClose={() => setTocOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setTocOpen(false)} accessibilityLabel="关闭目录" />
          <View style={[styles.drawer, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.drawerHead}>
              <Text style={styles.drawerTitle}>目录</Text>
              <Text style={styles.drawerCount}>{toc.length} 节</Text>
              <Pressable hitSlop={8} onPress={() => setTocOpen(false)} accessibilityRole="button" accessibilityLabel="关闭">
                <ThemedIcon name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            {toc.length === 0 ? (
              <Text style={styles.drawerEmpty}>本文没有分节标题，可直接阅读。</Text>
            ) : (
              <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
                {toc.map((item) => (
                  <Pressable key={item.id} onPress={() => jumpToHeading(item.id)} style={styles.drawerItem}>
                    <Text style={[styles.drawerItemText, item.level === 3 ? styles.drawerItemTextSub : null]} numberOfLines={2}>
                      {item.text}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    // v1.55 排版微调：给正文一个最大阅读宽度（平板/横屏不拉满），行高与段距已在正文渲染器里加档
    content: { width: "100%", maxWidth: 780, alignSelf: "center", paddingHorizontal: spacing.lg, gap: spacing.lg },
    tocButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
    centerTitle: { ...typography.headline, color: colors.text },
    centerText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
    retry: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    retryText: { ...typography.caption, fontWeight: "700", color: colors.primaryStrong },
    hero: { gap: spacing.sm, paddingTop: spacing.lg },
    heroBreadcrumb: { ...typography.caption, color: colors.textMuted },
    heroTitle: { ...typography.title1, color: colors.text },
    heroMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
    badgeMust: { backgroundColor: colors.dangerSoft },
    badgeCommon: { backgroundColor: colors.primarySoft },
    badgeText: { ...typography.micro, fontWeight: "700" },
    badgeTextMust: { color: colors.danger },
    badgeTextCommon: { color: colors.primaryStrong },
    heroMetaText: { ...typography.caption, color: colors.textFaint },
    pager: { gap: spacing.sm, marginTop: spacing.md },
    pagerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    pagerBody: { flex: 1, gap: 2 },
    pagerLabel: { ...typography.caption, color: colors.textFaint },
    pagerTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    sourceBox: {
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      gap: 4,
    },
    sourceTitle: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    sourceText: { ...typography.caption, color: colors.textFaint, lineHeight: 18 },
    sourceLink: { ...typography.caption, fontWeight: "700", color: colors.primary, marginTop: 2 },
    modalRoot: { flex: 1, flexDirection: "row" },
    backdrop: { flex: 1, backgroundColor: colors.scrim },
    drawer: {
      width: "80%",
      maxWidth: 360,
      backgroundColor: colors.canvas,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      borderTopLeftRadius: radius.xl,
      borderBottomLeftRadius: radius.xl,
    },
    drawerHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    drawerTitle: { ...typography.headline, fontWeight: "700", color: colors.text },
    drawerCount: { ...typography.caption, color: colors.textFaint, flex: 1 },
    drawerEmpty: { ...typography.caption, color: colors.textMuted },
    drawerList: { flex: 1 },
    drawerItem: {
      minHeight: 44,
      justifyContent: "center",
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    drawerItemText: { ...typography.callout, color: colors.text },
    drawerItemTextSub: { ...typography.caption, color: colors.textSecondary, paddingLeft: spacing.md },
  });