import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import {
  EXAM_408_STUDY_SUBJECTS,
  exam408StudyImportanceLabel,
  getExam408StudyCatalog,
  type Exam408StudyArticleSummary,
  type Exam408StudyCatalog,
  type Exam408StudySubjectKey,
} from "@/lib/exam-408-study";
import { setNavPendingParams } from "@/lib/nav-pending";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 408 精读·目录（v1.55）。cs408.cloud 的 181 篇正文按「科目 → 章节 → 文章」组织，
 * 这一屏只做导航；正文在 exam-408-study-read。
 *
 * 为什么要独立一屏而不是塞进 408 专区的 Tab：精读是长文阅读场景（通勤时一屏一节地读），
 * 与专区的「按知识点刷题」是两种节奏；分屏后可以各自保持自己的滚动位置与返回路径。
 */
export default function Exam408StudyScreen() {
  const params = useLocalSearchParams<{ subject?: string }>();
  const initialSubject = useMemo<Exam408StudySubjectKey>(() => {
    const candidate = params.subject?.trim() ?? "";
    return (EXAM_408_STUDY_SUBJECTS.find((item) => item.key === candidate)?.key ?? "data-structure") as Exam408StudySubjectKey;
  }, [params.subject]);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [subject, setSubject] = useState<Exam408StudySubjectKey>(initialSubject);
  const [catalog, setCatalog] = useState<Exam408StudyCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** 当前选中科目（ref 而非 state：进 load 依赖会让 useFocusEffect 回调身份抖动、重复请求） */
  const subjectRef = useRef<Exam408StudySubjectKey>(initialSubject);

  const load = useCallback(async (next: Exam408StudySubjectKey) => {
    subjectRef.current = next;
    setLoading(true);
    setError("");
    try {
      const nextCatalog = await getExam408StudyCatalog(next);
      if (subjectRef.current === next) setCatalog(nextCatalog);
    } catch (reason) {
      if (subjectRef.current === next) {
        setCatalog(null);
        setError(reason instanceof Error ? reason.message : "精读目录加载失败");
      }
    } finally {
      if (subjectRef.current === next) setLoading(false);
    }
  }, []);

  // 首次进入与从阅读页返回都刷新一次（目录页数据量小；返回时可能是新导入的正文）
  useFocusEffect(
    useCallback(() => {
      void load(subjectRef.current);
    }, [load]),
  );

  const pickSubject = (next: Exam408StudySubjectKey) => {
    setSubject(next);
    void load(next);
  };

  const openArticle = (article: Exam408StudyArticleSummary) => {
    // 同名路由重复 push 时 expo-router 会冻结 params（v1.51 踩坑），走场外通道更稳
    setNavPendingParams("exam-408-study-read", { slug: article.slug });
    router.push(("/exam-408-study-read?slug=" + encodeURIComponent(article.slug)) as never);
  };

  const total = catalog?.total ?? 0;
  const chapterCount = catalog?.chapters.length ?? 0;

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="知识精读" scrollY={header.scrollY} backTo="/exam-408" />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle title="知识精读" subtitle="按章节读原文 · 通勤也能一屏一节地读" />

        <View style={styles.subjectRail}>
          {EXAM_408_STUDY_SUBJECTS.map((item) => {
            const active = item.key === subject;
            return (
              <PressableScale
                key={item.key}
                haptic
                scaleTo={0.97}
                onPress={() => pickSubject(item.key)}
                style={[styles.subjectChip, active ? styles.subjectChipActive : null]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.subjectChipText, active ? styles.subjectChipTextActive : null]} numberOfLines={1}>
                  {item.title}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centerText}>正在加载精读目录…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <ThemedIcon name="alert-circle-outline" size={26} color={colors.danger} />
            <Text style={styles.centerTitle}>精读目录加载失败</Text>
            <Text style={styles.centerText}>{error}</Text>
            <PressableScale haptic onPress={() => void load(subjectRef.current)} style={styles.retry}>
              <Text style={styles.retryText}>重试</Text>
            </PressableScale>
          </View>
        ) : !catalog || total === 0 || chapterCount === 0 ? (
          <View style={styles.centerState}>
            <ThemedIcon
              name={catalog ? "file-tray-outline" : "alert-circle-outline"}
              size={26}
              color={colors.textMuted}
            />
            <Text style={styles.centerTitle}>
              {catalog ? "这一科还没有精读正文" : "精读目录数据异常"}
            </Text>
            <Text style={styles.centerText}>
              {catalog
                ? "换个科目看看，或点下方重新加载；确认线上有正文时请反馈给我们。"
                : "接口返回里没有识别到章节/文章结构，请重新加载后再试。"}
            </Text>
            <PressableScale haptic onPress={() => void load(subjectRef.current)} style={styles.retry}>
              <Text style={styles.retryText}>重新加载</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            <Animated.View entering={entrance(0)} style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{total}</Text>
              <Text style={styles.summaryLabel}>篇精读</Text>
              <View style={styles.summaryDivider} />
              <Text style={styles.summaryValue}>{chapterCount}</Text>
              <Text style={styles.summaryLabel}>个章节</Text>
              <View style={styles.summaryDivider} />
              <Text style={styles.summaryHint}>原文：cs408.cloud</Text>
            </Animated.View>

            {catalog?.chapters.map((chapter, chapterIndex) => (
              <Animated.View key={chapter.chapter} entering={entrance(Math.min(chapterIndex + 1, 6))} style={styles.chapterBlock}>
                <View style={styles.chapterHead}>
                  <Text style={styles.chapterTitle} numberOfLines={1}>
                    {chapter.chapter}
                  </Text>
                  <Text style={styles.chapterCount}>{chapter.articles.length} 篇</Text>
                </View>
                <View style={styles.articleList}>
                  {chapter.articles.map((article) => (
                    <PressableScale
                      key={article.key || article.slug}
                      haptic
                      scaleTo={0.99}
                      onPress={() => openArticle(article)}
                      style={styles.articleRow}
                      accessibilityRole="button"
                      accessibilityLabel={"阅读 " + article.title}
                    >
                      <View style={styles.articleBody}>
                        <Text style={styles.articleTitle} numberOfLines={2}>
                          {article.title}
                        </Text>
                        <View style={styles.articleMeta}>
                          <View style={[styles.badge, badgeStyle(article.importance, colors)]}>
                            <Text style={[styles.badgeText, badgeTextStyle(article.importance, colors)]}>
                              {exam408StudyImportanceLabel(article.importance)}
                            </Text>
                          </View>
                          {article.examFrequency > 0 ? (
                            <Text style={styles.articleMetaText}>真题 {article.examFrequency} 次</Text>
                          ) : (
                            <Text style={styles.articleMetaText}>统计未命中</Text>
                          )}
                        </View>
                      </View>
                      <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
                    </PressableScale>
                  ))}
                </View>
              </Animated.View>
            ))}

            <View style={styles.sourceBox}>
              <Text style={styles.sourceTitle}>来源与授权</Text>
              <Text style={styles.sourceText}>
                正文镜像自 cs408.cloud「知识精读」（作者已授权个人学习、非商业用途），保留署名与原文链接；图片本地化后随内容包分发。
              </Text>
            </View>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

function badgeStyle(importance: string, colors: ThemeColors) {
  if (importance === "must") return { backgroundColor: colors.dangerSoft };
  if (importance === "rare" || importance === "none") return { backgroundColor: colors.surfaceMuted };
  return { backgroundColor: colors.primarySoft };
}

function badgeTextStyle(importance: string, colors: ThemeColors) {
  if (importance === "must") return { color: colors.danger };
  if (importance === "rare" || importance === "none") return { color: colors.textMuted };
  return { color: colors.primaryStrong };
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    subjectRail: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    subjectChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    subjectChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    subjectChipText: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    subjectChipTextActive: { color: colors.surface },
    centerState: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing["2xl"] },
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
    summaryCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    summaryValue: { ...typography.headline, fontWeight: "800", color: colors.text },
    summaryLabel: { ...typography.caption, color: colors.textMuted },
    summaryDivider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.borderStrong, marginHorizontal: spacing.xs },
    summaryHint: { ...typography.caption, color: colors.textFaint, marginLeft: "auto" },
    chapterBlock: { gap: spacing.sm },
    chapterHead: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.sm },
    chapterTitle: { ...typography.headline, fontWeight: "700", color: colors.text, flex: 1 },
    chapterCount: { ...typography.caption, color: colors.textFaint },
    articleList: {
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    articleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    articleBody: { flex: 1, gap: 6 },
    articleTitle: { ...typography.body, fontWeight: "600", color: colors.text },
    articleMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
    badgeText: { ...typography.micro, fontWeight: "700" },
    articleMetaText: { ...typography.caption, color: colors.textFaint },
    sourceBox: {
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      gap: 4,
    },
    sourceTitle: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    sourceText: { ...typography.caption, color: colors.textFaint, lineHeight: 18 },
  });