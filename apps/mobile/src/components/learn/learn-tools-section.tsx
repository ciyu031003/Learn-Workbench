import { router } from "expo-router";
import { Text } from "react-native";
import { SectionTitle } from "@/components/v2/section-title";
import { useTheme } from "@/theme";
import { DAILY_QUESTION_GOAL } from "./learn-widgets";
import { LearnToolsGrid, type LearnToolItem } from "./learn-tools-grid";
import { makeStyles } from "./learn-styles";

/**
 * 学习工具（P2 · 三层结构第二层）：v2.7 起 3 个入口（复习与错题 / 技术题库 / 408 专区）。
 *
 * 层级变化：原来「复习大卡 + 3 行等权列表」共 7 个入口并排，用户看不出下一步；
 * 现在只保留 4 个工具，数字本身承担优先级：待复习（到期数）/ 技术题库（今日进度）/
 * 错题练习（错题数 + 正确率）/ 408 专区（章节数）。
 * 401/离线时到期数显示「—」而不是 0（沿用原 reviewStats.remoteOk 语义）。
 */
export function LearnToolsSection({
  reviewStats,
  learningSummary,
  questionCount,
  exam408ChapterCount,
  exam408PointCount,
  practiceAccuracy,
}: {
  reviewStats: { due: number; wrong: number; total: number; mastered: number; remoteOk: boolean } | null;
  learningSummary: { today: number; attempted: number; correct: number; wrong: number };
  questionCount: number;
  exam408ChapterCount: number;
  exam408PointCount: number;
  practiceAccuracy: number | null;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const dueValue = reviewStats && reviewStats.remoteOk && reviewStats.due > 0 ? String(reviewStats.due) : "—";
  const dueHint = !reviewStats
    ? "登录后可看记忆曲线排期"
    : reviewStats.remoteOk
      ? reviewStats.total > 0
        ? "已掌握 " + reviewStats.mastered + " / " + reviewStats.total
        : "按记忆曲线排期"
      : "错题 " + reviewStats.wrong + " 道 · 到期需联网";

  /**
   * 「待复习」与「错题练习」原来各占一格，但跳的是同一个页面，
   * 合并成一张通栏主卡：到期数当主数值，错题数与正确率并进副文案。
   */
  const wrongSummary =
    learningSummary.wrong > 0
      ? "错题 " + learningSummary.wrong + " 道" + (practiceAccuracy === null ? "" : " · 正确率 " + practiceAccuracy + "%")
      : practiceAccuracy === null
        ? dueHint
        : dueHint + " · 正确率 " + practiceAccuracy + "%";

  const featured: LearnToolItem = {
    key: "review",
    icon: "alarm-outline",
    value: dueValue,
    title: "复习与错题",
    hint: wrongSummary,
    tone: "primary",
    onPress: () => router.push("/quiz/review" as never),
    accessibilityLabel:
      reviewStats && reviewStats.remoteOk
        ? "打开复习，已到期 " + reviewStats.due + " 个知识点"
        : "打开复习与错题",
  };

  const items: LearnToolItem[] = [
    {
      key: "bank",
      icon: "help-circle-outline",
      value: questionCount > 0 ? questionCount + " 题" : "—",
      title: "技术题库",
      hint:
        learningSummary.today > 0
          ? "今日 " + learningSummary.today + " / " + DAILY_QUESTION_GOAL + " 题 · 继续刷题"
          : "每日目标 " + DAILY_QUESTION_GOAL + " 题",
      onPress: () => router.push("/quiz" as never),
      accessibilityLabel: "打开技术题库，共 " + questionCount + " 题",
    },
    {
      key: "exam408",
      icon: "trophy-outline",
      value: exam408ChapterCount > 0 ? exam408ChapterCount + " 章" : "—",
      title: "408 专区",
      hint: exam408PointCount > 0 ? exam408PointCount + " 个知识点" : "精读 / 演示 / 刷卡",
      onPress: () => router.push("/exam-408" as never),
      accessibilityLabel: "打开 408 考研专区",
    },
  ];

  return (
    <>
      <SectionTitle
        title="学习工具"
        right={<Text style={styles.sectionMeta}>今天先做哪一个</Text>}
        style={styles.sectionTitle}
      />
      <LearnToolsGrid featured={featured} items={items} />
    </>
  );
}
