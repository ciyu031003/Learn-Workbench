import { router } from "expo-router";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { SectionTitle } from "@/components/v2/section-title";
import { useTheme } from "@/theme";

import { DAILY_QUESTION_GOAL } from "./learn-widgets";
import { LearnToolsGrid, type LearnToolItem, type LearnToolTuple } from "./learn-tools-grid";
import { makeStyles } from "./learn-styles";

/**
 * ⑤ 学习工具区块（对齐 V12）：
 * - 顶部一条「今天先做」主线，只放当前最该点的动作；
 * - 下面 2×3 竖式大卡（复习与错题 / 技术题库 / 408 专区 / 学习统计 / 阶段路线 / 材料阅读）；
 * - 每张卡的主数字都来自真实数据，卡底细条表示真实进度；
 * - 不写解释性长文案，工具卡自己说明下一步。
 */
export function LearnToolsSection({
  reviewStats,
  learningSummary,
  questionCount,
  exam408ChapterCount,
  exam408PointCount,
  practiceAccuracy,
  phaseWeeks,
  topicCount,
  phasePercent,
}: {
  reviewStats: { due: number; wrong: number; total: number; mastered: number; remoteOk: boolean } | null;
  learningSummary: { today: number; attempted: number; correct: number; wrong: number };
  questionCount: number;
  exam408ChapterCount: number;
  exam408PointCount: number;
  practiceAccuracy: number | null;
  phaseWeeks: string;
  topicCount: number;
  phasePercent: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const goReview = () => router.push("/quiz/review" as never);
  const goBank = () => router.push("/quiz" as never);
  const go408 = () => router.push("/exam-408" as never);

  const goalLeft = Math.max(0, DAILY_QUESTION_GOAL - learningSummary.today);
  const focus =
    reviewStats?.remoteOk && reviewStats.due > 0
      ? { icon: "alarm" as const, title: "先清 " + reviewStats.due + " 道到期复习", meta: "按记忆曲线排期 · 错题 " + reviewStats.wrong, cta: "去复习", onPress: goReview }
      : goalLeft > 0
        ? { icon: "target" as const, title: "今天还差 " + goalLeft + " 题", meta: "已完成 " + learningSummary.today + " / " + DAILY_QUESTION_GOAL, cta: "去刷题", onPress: goBank }
        : { icon: "flag" as const, title: "今日题量已完成", meta: "再读一章或刷一组 408 卡", cta: "去 408", onPress: go408 };

  const reviewProgress =
    reviewStats && reviewStats.total > 0 ? reviewStats.mastered / reviewStats.total : undefined;
  const bankProgress = Math.min(1, learningSummary.today / DAILY_QUESTION_GOAL);

  const reviewItem: LearnToolItem = {
    key: "review",
    icon: "alarm",
    title: "复习与错题",
    value: reviewStats ? String(reviewStats.due) : "—",
    unit: "题",
    meta: !reviewStats
      ? "登录后看排期"
      : reviewStats.remoteOk
        ? "错题 " + reviewStats.wrong + " · 掌握 " + reviewStats.mastered + "/" + reviewStats.total
        : "离线 · 错题 " + reviewStats.wrong,
    tone: "primary",
    progress: reviewProgress,
    onPress: goReview,
    accessibilityLabel:
      reviewStats && reviewStats.remoteOk
        ? "打开复习与错题，已到期 " + reviewStats.due + " 个知识点，错题 " + reviewStats.wrong + " 道"
        : "打开复习与错题",
  };

  const bankItem: LearnToolItem = {
    key: "bank",
    icon: "list",
    title: "技术题库",
    value: questionCount > 0 ? String(questionCount) : "—",
    unit: "题",
    meta: questionCount > 0 ? "今日 " + learningSummary.today + "/" + DAILY_QUESTION_GOAL : "还没有题库内容",
    tone: "success",
    progress: bankProgress,
    onPress: goBank,
    accessibilityLabel: "打开技术题库，共 " + questionCount + " 题，今日已做 " + learningSummary.today + " 题",
  };

  const exam408Item: LearnToolItem = {
    key: "exam408",
    icon: "flag",
    title: "408 专区",
    value: exam408ChapterCount > 0 ? String(exam408ChapterCount) : "—",
    unit: "章",
    meta: exam408PointCount > 0 ? exam408PointCount + " 个知识点" : "精读 · 刷卡",
    tone: "accent",
    onPress: go408,
    accessibilityLabel: "打开 408 考研专区，" + exam408ChapterCount + " 章 " + exam408PointCount + " 个知识点",
  };

  const statsItem: LearnToolItem = {
    key: "stats",
    icon: "trend",
    title: "学习统计",
    value: practiceAccuracy === null ? "—" : String(practiceAccuracy),
    unit: practiceAccuracy === null ? undefined : "%",
    meta: "累计 " + learningSummary.attempted + " 题 · 对 " + learningSummary.correct,
    tone: "lavender",
    progress: practiceAccuracy === null ? undefined : practiceAccuracy / 100,
    onPress: () => router.push("/study-stats" as never),
    accessibilityLabel:
      practiceAccuracy === null
        ? "打开学习统计，累计作答 " + learningSummary.attempted + " 题"
        : "打开学习统计，正确率 " + practiceAccuracy + "%",
  };

  const roadmapItem: LearnToolItem = {
    key: "roadmap",
    icon: "folder",
    title: "阶段路线",
    value: String(topicCount),
    unit: "主题",
    meta: phaseWeeks,
    tone: "teal",
    progress: phasePercent / 100,
    onPress: () => router.push("/roadmap" as never),
    accessibilityLabel: "打开阶段路线，" + topicCount + " 个主题",
  };

  const readingItem: LearnToolItem = {
    key: "reading",
    icon: "reading",
    title: "材料阅读",
    value: "精读",
    meta: "长文 · 题组 · 术语表",
    tone: "primary",
    onPress: () => router.push("/quiz/read" as never),
    accessibilityLabel: "打开材料阅读",
  };

  const items: LearnToolTuple = [reviewItem, bankItem, exam408Item, statsItem, roadmapItem, readingItem];

  return (
    <>
      <SectionTitle
        title="学习工具"
        right={<Text style={styles.sectionMeta}>6 个入口</Text>}
        style={styles.sectionTitle}
      />

      <PressableScale
        haptic
        scaleTo={0.985}
        hitSlop={4}
        onPress={focus.onPress}
        style={styles.focusBar}
        accessibilityRole="button"
        accessibilityLabel={focus.title + "，" + focus.cta}
      >
        <View style={styles.focusIcon}>
          <Icon name={focus.icon} size={19} weight="duotone" color={colors.primary} />
        </View>
        <View style={styles.focusBody}>
          <Text style={styles.focusTitle} numberOfLines={1}>{focus.title}</Text>
          <Text style={styles.focusMeta} numberOfLines={1}>{focus.meta}</Text>
        </View>
        <View style={styles.focusCta}>
          <Text style={styles.focusCtaText}>{focus.cta}</Text>
          <Icon name="chevron" size={12} weight="bold" color="#FFFFFF" />
        </View>
      </PressableScale>

      <LearnToolsGrid items={items} />
    </>
  );
}
