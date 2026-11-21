import { router } from "expo-router";
import { Text } from "react-native";

import { SectionTitle } from "@/components/v2/section-title";
import { useTheme } from "@/theme";

import { DAILY_QUESTION_GOAL } from "./learn-widgets";
import { LearnToolsGrid, type LearnToolItem, type LearnToolTuple } from "./learn-tools-grid";
import { makeStyles } from "./learn-styles";

/**
 * ⑤ 学习工具区块：2×2 四张行式卡（复习与错题 / 技术题库 / 408 专区 / 学习统计）。
 *
 * 数字全部来自既有真实数据：
 * - 复习：reviewStats.due / wrong（remoteOk=false 表示离线拿不到排期 → 写「到期需联网」而不是 0）
 * - 题库：questionCount + 今日作答数（learningSummary.today）+ 每日目标
 * - 408：exam408ChapterCount 章 / exam408PointCount 知识点（来自内容库 ex-408-grad）
 * - 统计：practiceAccuracy + 累计作答（learningSummary.attempted）
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

  const reviewMeta = !reviewStats
    ? "登录后看记忆曲线排期"
    : reviewStats.remoteOk
      ? "到期 " + reviewStats.due + " · 错题 " + reviewStats.wrong
      : "到期需联网 · 错题 " + reviewStats.wrong;

  const reviewItem: LearnToolItem = {
    key: "review",
    icon: "alarm",
    title: "复习与错题",
    meta: reviewMeta,
    tone: "primary",
    onPress: () => router.push("/quiz/review" as never),
    accessibilityLabel:
      reviewStats && reviewStats.remoteOk
        ? "打开复习与错题，已到期 " + reviewStats.due + " 个知识点，错题 " + reviewStats.wrong + " 道"
        : "打开复习与错题",
  };

  const bankItem: LearnToolItem = {
    key: "bank",
    icon: "list",
    title: "技术题库",
    meta: questionCount > 0 ? questionCount + " 题 · 今日 " + learningSummary.today + "/" + DAILY_QUESTION_GOAL : "还没有题库内容",
    tone: "success",
    onPress: () => router.push("/quiz" as never),
    accessibilityLabel: "打开技术题库，共 " + questionCount + " 题，今日已做 " + learningSummary.today + " 题",
  };

  const exam408Item: LearnToolItem = {
    key: "exam408",
    icon: "flag",
    title: "408 专区",
    meta: exam408ChapterCount > 0 ? exam408ChapterCount + " 章 · " + exam408PointCount + " 知识点" : "精读 / 演示 / 刷卡",
    tone: "accent",
    onPress: () => router.push("/exam-408" as never),
    accessibilityLabel: "打开 408 考研专区，" + exam408ChapterCount + " 章 " + exam408PointCount + " 个知识点",
  };

  const statsItem: LearnToolItem = {
    key: "stats",
    icon: "trend",
    title: "学习统计",
    meta: practiceAccuracy === null ? "累计 " + learningSummary.attempted + " 题 · 还没有正确率" : "正确率 " + practiceAccuracy + "% · 累计 " + learningSummary.attempted + " 题",
    tone: "lavender",
    onPress: () => router.push("/study-stats" as never),
    accessibilityLabel:
      practiceAccuracy === null
        ? "打开学习统计，累计作答 " + learningSummary.attempted + " 题"
        : "打开学习统计，正确率 " + practiceAccuracy + "%",
  };

  const items: LearnToolTuple = [reviewItem, bankItem, exam408Item, statsItem];

  return (
    <>
      <SectionTitle
        title="学习工具"
        right={<Text style={styles.sectionMeta}>今天先做哪一个</Text>}
        style={styles.sectionTitle}
      />
      <LearnToolsGrid items={items} />
    </>
  );
}
