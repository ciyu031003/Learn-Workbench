import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { SkeletonList } from "@/components/skeleton";
import { ThemedIcon } from "@/components/themed-icon";
import {
  fetchPaperAttempts,
  formatPaperAttemptTime,
  formatPaperDuration,
  loadPaperHistory,
  paperAccuracy,
  type PaperAttemptFailure,
  type PaperAttemptRecord,
} from "@/lib/paper-history";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 408 套卷历史成绩（P3-2B）。
 *
 * 数据策略：登录用户优先读服务端（GET /api/exam/408/paper-attempts?limit=20），
 * 未登录 / 离线 / 服务端异常时回退本机缓存（lwb.paper.history.v1）并在顶部标注来源与原因。
 *
 * 动效纪律：本页不加入场 / 滚动动画（motion 预算已满）；字阶一律走 typography token。
 */
export default function Exam408PaperHistoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bottomSpace = useTabBarSpace();

  const [attempts, setAttempts] = useState<PaperAttemptRecord[]>([]);
  const [total, setTotal] = useState(0);
  /** 数据来源：服务端最新 / 本机缓存（离线或未登录） */
  const [source, setSource] = useState<"server" | "cache">("server");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState<PaperAttemptFailure | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    const result = await fetchPaperAttempts(20);
    if (!result.failure) {
      setAttempts(result.attempts);
      setTotal(result.total);
      setSource("server");
      setNotice("");
      setLoading(false);
      return;
    }

    // 服务端不可用：回退本机缓存（离线 / 未登录都能看到上次同步或本地交卷的记录）
    const cached = await loadPaperHistory();
    setAttempts(cached);
    setTotal(cached.length);
    setSource("cache");
    setFailure(result.failure);
    setNotice(
      result.failure === "unauthorized"
        ? "未登录：下面只显示本机保存的成绩，登录后自动同步服务端记录。"
        : result.failure === "offline"
          ? "网络不可用：下面显示本机缓存，联网后可重试读取服务端记录。"
          : "服务端暂时不可用：下面显示本机缓存，稍后可重试。"
    );
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && attempts.length === 0) {
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="历史成绩" backTo="/exam-408" />
        <View style={styles.content}>
          <SkeletonList count={4} />
        </View>
      </View>
    );
  }

  if (failure && attempts.length === 0) {
    const unauthorized = failure === "unauthorized";
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="历史成绩" backTo="/exam-408" />
        <View style={styles.centerBox}>
          <EmptyState
            icon={unauthorized ? "lock-closed-outline" : "cloud-offline-outline"}
            title={unauthorized ? "登录后可同步成绩" : "成绩加载失败"}
            hint={notice}
            actionLabel="重试"
            onAction={() => void load()}
            pattern="none"
          />
        </View>
      </View>
    );
  }

  if (attempts.length === 0) {
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="历史成绩" backTo="/exam-408" />
        <View style={styles.centerBox}>
          <EmptyState
            icon="document-text-outline"
            title="还没有套卷成绩"
            hint="完成一套 408 真题并交卷后，成绩会自动记录在这里。"
            actionLabel="去 408 专区"
            onAction={() => router.replace("/exam-408" as never)}
            pattern="none"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="历史成绩" backTo="/exam-408" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ThemedIcon name="time-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle}>套卷成绩记录</Text>
            <Text style={styles.heroText}>
              {source === "server"
                ? `服务端共 ${total} 条，展示最近 ${attempts.length} 条`
                : `本机缓存 ${attempts.length} 条（最多保留 20 条）`}
            </Text>
          </View>
        </View>

        {notice ? (
          <View style={styles.notice}>
            <ThemedIcon name="cloud-offline-outline" size={16} color={colors.warning} />
            <Text style={styles.noticeText}>{notice}</Text>
            <PressableScale haptic onPress={() => void load()} style={styles.noticeRetry}>
              <Text style={styles.noticeRetryText}>重试</Text>
            </PressableScale>
          </View>
        ) : null}

        <View style={styles.list}>
          {attempts.map((attempt) => (
            <AttemptRow key={attempt.id} attempt={attempt} styles={styles} colors={colors} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** 单条成绩：年份 / 得分 / 正确率 / 用时 / 交卷时间 */
function AttemptRow({
  attempt,
  styles,
  colors,
}: {
  attempt: PaperAttemptRecord;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  const accuracy = paperAccuracy(attempt.correct, attempt.wrong);
  const scoreText = attempt.totalScore > 0 ? `${attempt.score}/${attempt.totalScore}` : `${attempt.score}`;
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <View style={styles.yearBadge}>
          <Text style={styles.yearBadgeText}>{attempt.year}</Text>
        </View>
        <Text style={styles.rowTitle}>{attempt.year} 年 408 真题</Text>
        <Text style={styles.rowTime}>{formatPaperAttemptTime(attempt.submittedAt)}</Text>
      </View>

      <View style={styles.metricRow}>
        <RowMetric label="得分" value={scoreText} styles={styles} tone="primary" />
        <RowMetric label="正确率" value={`${accuracy}%`} styles={styles} tone={accuracy >= 60 ? "success" : "danger"} />
        <RowMetric label="用时" value={formatPaperDuration(attempt.durationSeconds)} styles={styles} />
      </View>

      <View style={styles.rowMeta}>
        <ThemedIcon name="checkmark-circle" size={13} color={colors.success} />
        <Text style={styles.rowMetaText}>答对 {attempt.correct}</Text>
        <ThemedIcon name="close-circle" size={13} color={colors.danger} />
        <Text style={styles.rowMetaText}>答错 {attempt.wrong}</Text>
        <Text style={styles.rowMetaText}>未答 {attempt.unanswered}</Text>
      </View>
    </View>
  );
}

function RowMetric({
  label,
  value,
  styles,
  tone = "muted",
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  tone?: "primary" | "success" | "danger" | "muted";
}) {
  const valueStyle =
    tone === "primary"
      ? styles.metricValuePrimary
      : tone === "success"
        ? styles.metricValueSuccess
        : tone === "danger"
          ? styles.metricValueDanger
          : styles.metricValue;
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValueBase, valueStyle]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.md },
    centerBox: { flex: 1, justifyContent: "center", padding: spacing.lg },
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.primarySoft,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    heroBody: { flex: 1, gap: 2 },
    heroTitle: { ...typography.headline, color: colors.text },
    heroText: { ...typography.caption, color: colors.textSecondary },
    notice: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.warningSoft,
    },
    noticeText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },
    noticeRetry: {
      minHeight: 32,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceStrong,
    },
    noticeRetryText: { ...typography.caption, fontWeight: "800", color: colors.primary },
    list: { gap: spacing.md },
    row: {
      gap: spacing.sm,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    yearBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    yearBadgeText: { ...typography.caption, fontWeight: "800", color: colors.primary, fontVariant: ["tabular-nums"] },
    rowTitle: { ...typography.callout, fontWeight: "800", color: colors.text, flex: 1 },
    rowTime: { ...typography.micro, color: colors.textFaint },
    metricRow: { flexDirection: "row", gap: spacing.sm },
    metric: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    metricValueBase: { ...typography.callout, fontWeight: "800", fontVariant: ["tabular-nums"] },
    metricValue: { color: colors.text },
    metricValuePrimary: { color: colors.primary },
    metricValueSuccess: { color: colors.success },
    metricValueDanger: { color: colors.danger },
    metricLabel: { ...typography.micro, color: colors.textMuted },
    rowMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    rowMetaText: { ...typography.caption, color: colors.textMuted },
  });
