import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import Animated from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { Exam408QuestionCard } from "@/components/exam-408-question-card";
import { RichText } from "@/components/rich-text";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { getExam408Point, type Exam408PointDetail } from "@/lib/exam-408";
import { internalizePointKey } from "@/lib/exam-408-point-key";
import {
  exam408TopicCounts,
  getExam408Topic,
  type Exam408Topic,
} from "@/lib/exam-408-topic";
import { exam408BodyParagraphs } from "@/lib/exam-408-view";
import { friendlyError } from "@/lib/friendly-error";
import { takeNavPendingParams } from "@/lib/nav-pending";
import { recordCrumb } from "@/lib/crash-capture";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

export default function Exam408PointScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const pointKey = params.key?.trim() ?? "";
  if (!pointKey) return <MissingPoint />;
  return <PointContent pointKey={pointKey} />;
}

function PointContent({ pointKey }: { pointKey: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const navigation = useNavigation();
  const [detail, setDetail] = useState<Exam408PointDetail | null>(null);
  /** 知识点聚合（v1.55）：精读文章 / 演示 / 速记卡入口；失败时静默降级，不影响正文与真题 */
  const [topic, setTopic] = useState<Exam408Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /**
   * 知识点正文（v1.54.0）。旧接口无此列 → 空数组 → 整个区块不渲染，
   * 保持 1.53.x 的老页面形态。hook 必须在下面的提前 return 之前。
   */
  const bodyParagraphs = useMemo(
    () => exam408BodyParagraphs(detail?.point.body),
    [detail],
  );
  const topicCounts = useMemo(() => exam408TopicCounts(topic), [topic]);
  /**
   * 本实例已解析的知识点 key（ref 而非 state：进 load 依赖会改变 useFocusEffect
   * 回调身份，聚焦态下身份变化会立即重跑回调 → 每次聚焦多发一次请求）。
   */
  const activeKeyRef = useRef("");
  /** 双通道去抖：同一 key 的两次紧邻触发（focus + params effect）只发一次请求 */
  const lastLoadRef = useRef({ key: "", at: 0 });

  const load = useCallback(async () => {
    // v1.51 修复「点开所有知识点都是同一套题」：expo-router 在 native 上重复推入
    // 同名路由时实例 params 冻结在首次值。跳转方把目标 key 写入场外通道
    // （nav-pending），这里优先消费它；ref 里是本实例上次实际加载的 key；
    // params 只作深链/状态恢复的兜底。
    const pendingKey = takeNavPendingParams("quiz-408-point")?.key ?? "";
    // P7：路由参数 / 场外通道可能携带展示前缀 yuanabd-408，请求 API 前 internalize 回库内主键
    const key = internalizePointKey(pendingKey || activeKeyRef.current || pointKey);
    // v1.53.1 诊断：真机上该修复未生效（14:44 后点击知识点零请求），面包屑留证
    recordCrumb("408-point-load", {
      pending: pendingKey,
      active: activeKeyRef.current,
      param: pointKey,
      resolved: key,
    });
    const now = Date.now();
    if (key === lastLoadRef.current.key && now - lastLoadRef.current.at < 500) {
      return;
    }
    lastLoadRef.current = { key, at: now };
    activeKeyRef.current = key;
    setLoading(true);
    setError("");
    try {
      // 两个请求并行：主体（知识点 + 真题）失败才报错；聚合失败只让入口区块消失
      const [pointResult, topicResult] = await Promise.allSettled([
        getExam408Point(key),
        getExam408Topic(key),
      ]);
      if (pointResult.status === "fulfilled") {
        setDetail(pointResult.value);
      } else {
        setDetail(null);
        setError(friendlyError(pointResult.reason, "知识点加载失败"));
      }
      setTopic(topicResult.status === "fulfilled" ? topicResult.value : null);
    } finally {
      setLoading(false);
    }
  }, [pointKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // v1.53.1 双通道消费：params 若被路由器更新（非冻结路径），pointKey 变化时
  // useFocusEffect 的 load 身份变化会自动重跑；这里显式兜一层 params effect。
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey]);

  // v1.53.1 诊断：focus/blur 事件是否在真机上正常投递（「后续点击零请求」的头号嫌疑）
  useEffect(() => {
    const offFocus = navigation.addListener("focus", () => {
      recordCrumb("408-point-focus", {});
    });
    const offBlur = navigation.addListener("blur", () => {
      recordCrumb("408-point-blur", {});
    });
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>正在加载知识点…</Text>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.centerState}>
        <ThemedIcon name="alert-circle-outline" size={26} color={colors.danger} />
        <Text style={styles.centerTitle}>知识点加载失败</Text>
        <Text style={styles.centerText}>{error || "未找到该知识点"}</Text>
        <PressableScale haptic onPress={() => void load()} style={styles.retry}>
          <Text style={styles.retryText}>重试</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title={detail.point.title} scrollY={header.scrollY} backTo="/exam-408" />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={entrance(0)} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <ThemedIcon name="book-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroSubject}>{detail.point.subject.title}</Text>
              <Text style={styles.heroChapter}>
                第 {detail.point.chapter.chapterNumber} 章 · {detail.point.chapter.title}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{detail.point.title}</Text>
          <RichText text={detail.point.summary} style={styles.heroSummary} />
          <View style={styles.heroStats}>
            <View style={styles.countBox}>
              <Text style={styles.countValue}>{detail.point.questionCount}</Text>
              <Text style={styles.countLabel}>关联真题</Text>
            </View>
            <View style={styles.tagWrap}>
              {detail.point.tags.slice(0, 6).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {bodyParagraphs.length > 0 ? (
          <Animated.View entering={entrance(1)} style={styles.bodyCard}>
            <View style={styles.bodyHead}>
              <ThemedIcon name="document-text-outline" size={17} color={colors.primary} />
              <Text style={styles.bodyTitle}>知识点正文</Text>
            </View>
            <View style={styles.bodyList}>
              {bodyParagraphs.map((paragraph, index) => (
                <RichText
                  key={`body-${index}`}
                  text={paragraph.text}
                  style={paragraph.heading ? styles.bodyParagraphHeading : styles.bodyParagraph}
                />
              ))}
            </View>
          </Animated.View>
        ) : null}

        {topicCounts.articles + topicCounts.cards + topicCounts.demos > 0 ? (
          <Animated.View entering={entrance(2)} style={styles.extensionCard}>
            <View style={styles.bodyHead}>
              <ThemedIcon name="sparkles-outline" size={17} color={colors.primary} />
              <Text style={styles.bodyTitle}>延伸内容</Text>
              <Text style={styles.extensionHint}>按知识点聚合</Text>
            </View>

            {topicCounts.articles > 0 && topic ? (
              <View style={styles.extensionGroup}>
                <View style={styles.extensionHead}>
                  <ThemedIcon ios="book" name="reader-outline" size={14} color={colors.primary} />
                  <Text style={styles.extensionTitle}>精读文章</Text>
                  <Text style={styles.extensionCount}>{topicCounts.articles} 篇</Text>
                </View>
                {topic.articles.slice(0, 3).map((article) => (
                  <PressableScale
                    key={article.slug}
                    haptic
                    onPress={() =>
                      router.push(`/exam-408-study-read?slug=${encodeURIComponent(article.slug)}` as never)
                    }
                    style={styles.extensionRow}
                    accessibilityRole="button"
                    accessibilityLabel={"阅读精读：" + article.title}
                  >
                    <Text style={styles.extensionRowText} numberOfLines={1}>
                      {article.title}
                    </Text>
                    <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
                  </PressableScale>
                ))}
                {topicCounts.articles > 3 ? (
                  <Text style={styles.extensionMore}>还有 {topicCounts.articles - 3} 篇，去精读目录查看</Text>
                ) : null}
              </View>
            ) : null}

            {topicCounts.demos > 0 && topic ? (
              <View style={styles.extensionGroup}>
                <View style={styles.extensionHead}>
                  <ThemedIcon ios="play.rectangle" name="play-circle-outline" size={14} color={colors.primary} />
                  <Text style={styles.extensionTitle}>交互动图</Text>
                  <Text style={styles.extensionCount}>{topicCounts.demos} 个</Text>
                </View>
                {topic.demos.slice(0, 3).map((demo) => (
                  <PressableScale
                    key={demo.key}
                    haptic
                    onPress={() =>
                      router.push(`/exam-408-viz-player?key=${encodeURIComponent(demo.key)}` as never)
                    }
                    style={styles.extensionRow}
                    accessibilityRole="button"
                    accessibilityLabel={"播放演示：" + demo.title}
                  >
                    <Text style={styles.extensionRowText} numberOfLines={1}>
                      {demo.title}
                    </Text>
                    <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
                  </PressableScale>
                ))}
                {topicCounts.demos > 3 ? (
                  <Text style={styles.extensionMore}>还有 {topicCounts.demos - 3} 个，去演示目录查看</Text>
                ) : null}
              </View>
            ) : null}

            {topicCounts.cards > 0 && topic ? (
              <View style={styles.extensionGroup}>
                <View style={styles.extensionHead}>
                  <ThemedIcon ios="rectangle.stack" name="albums-outline" size={14} color={colors.primary} />
                  <Text style={styles.extensionTitle}>速记卡</Text>
                  <Text style={styles.extensionCount}>{topicCounts.cards} 张</Text>
                </View>
                {topic.cards.slice(0, 3).map((card) => (
                  <PressableScale
                    key={card.key}
                    haptic
                    onPress={() =>
                      router.push(
                        (card.subjectKey
                          ? `/exam-408-drill?subject=${encodeURIComponent(card.subjectKey)}`
                          : "/exam-408-drill") as never,
                      )
                    }
                    style={styles.extensionRow}
                    accessibilityRole="button"
                    accessibilityLabel={"去刷卡：" + card.question}
                  >
                    <Text style={styles.extensionRowText} numberOfLines={1}>
                      {card.question || "速记卡"}
                    </Text>
                    <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
                  </PressableScale>
                ))}
                <Text style={styles.extensionMore}>评过错的卡会进入「易错本」，可立即重刷</Text>
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>关联真题</Text>
          <PressableScale haptic onPress={() => router.back()} style={styles.backButton}>
            <ThemedIcon name="arrow-back" size={15} color={colors.textMuted} />
            <Text style={styles.backText}>返回章节</Text>
          </PressableScale>
        </View>

        <View style={styles.questionList}>
          {detail.questions.map((question) => (
            <Animated.View key={question.key} entering={entrance(2)}>
              <Exam408QuestionCard question={question} />
            </Animated.View>
          ))}
        </View>

        <View style={styles.sourceBox}>
          <Text style={styles.sourceTitle}>来源</Text>
          <Text style={styles.sourceText}>
            {detail.source.name}（{detail.source.baseUrl}）。{detail.source.licenseNote}
          </Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function MissingPoint() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.centerState}>
      <ThemedIcon name="book-outline" size={26} color={colors.textMuted} />
      <Text style={styles.centerTitle}>缺少知识点参数</Text>
      <PressableScale haptic onPress={() => router.replace("/exam-408" as never)} style={styles.retry}>
        <Text style={styles.retryText}>返回 408 专区</Text>
      </PressableScale>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg },
    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      padding: spacing.xl,
      backgroundColor: colors.canvas,
    },
    centerTitle: { ...typography.title2, color: colors.text },
    centerText: { ...typography.callout, color: colors.textMuted, textAlign: "center" },
    retry: {
      minHeight: 44,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    retryText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    hero: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: colors.primarySoft,
      ...shadows.card,
    },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    heroBody: { flex: 1, gap: 2 },
    heroSubject: { ...typography.callout, fontWeight: "800", color: colors.primary },
    heroChapter: { ...typography.caption, color: colors.textMuted },
    heroTitle: { ...typography.title1, color: colors.text },
    heroSummary: { ...typography.body, color: colors.textSecondary },
    heroStats: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    countBox: {
      minWidth: 72,
      alignItems: "center",
      borderRadius: radius.md,
      padding: spacing.sm,
      backgroundColor: colors.surfaceStrong,
    },
    countValue: { ...typography.title2, color: colors.text, fontVariant: ["tabular-nums"] },
    countLabel: { ...typography.micro, color: colors.textMuted },
    tagWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.surfaceMuted },
    tagText: { ...typography.micro, color: colors.textSecondary },
    bodyCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    bodyHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    bodyTitle: { ...typography.headline, color: colors.text },
    // 段间距 12（规范 10-12）：长正文靠间距分段，不用分隔线，避免视觉噪音
    bodyList: { gap: spacing.md },
    bodyParagraph: { ...typography.body, color: colors.textSecondary },
    // 以【】开头的段落是正文里的小标题，加粗 + 主文本色，压过正文一档
    bodyParagraphHeading: { ...typography.body, fontWeight: "700", color: colors.text },
    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { ...typography.title2, color: colors.text },
    backButton: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
    backText: { ...typography.caption, color: colors.textMuted },
    questionList: { gap: spacing.md },
    extensionCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    extensionHint: { ...typography.caption, color: colors.textFaint, marginLeft: "auto" },
    extensionGroup: { gap: 2 },
    extensionHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 2 },
    extensionTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    extensionCount: { ...typography.micro, color: colors.textMuted, marginLeft: "auto" },
    extensionRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    extensionRowText: { ...typography.callout, color: colors.textSecondary, flex: 1 },
    extensionMore: { ...typography.micro, color: colors.textFaint, paddingTop: 4 },
    sourceBox: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: 4 },
    sourceTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    sourceText: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
  });
