import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 职业首页的决策区（P3）：只回答「下一步该做什么」，不做数据展示墙。
 *
 * 三行决策，按可执行性排序：
 *  1) 匹配方向：有多少岗位与我目标匹配 → 打开雷达
 *  2) 技能差距：还缺几项技能、共几小时 → 一键生成学习任务（本页唯一的写操作）
 *  3) 即将截止：最近 3 个有截止时间的岗位 → 打开雷达
 *
 * 行业惯例：决策卡必须带"可执行动作"，只显示数字的卡片不放在第一屏。
 */
export interface CareerDeadlineItem {
  key: string;
  title: string;
  company: string;
  deadlineLabel: string;
}

export function CareerDecisionCards({
  hasTarget,
  matchedCount,
  readinessPercent,
  gapCount,
  gapHours,
  gapSkills,
  deadlines,
  enrolling,
  onOpenRadar,
  onEnrollGaps,
}: {
  hasTarget: boolean;
  matchedCount: number | null;
  readinessPercent: number;
  gapCount: number;
  gapHours: number;
  gapSkills: string[];
  deadlines: CareerDeadlineItem[];
  enrolling: boolean;
  onOpenRadar: () => void;
  onEnrollGaps: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const matchValue = matchedCount === null ? "—" : hasTarget ? String(matchedCount) : "待设置";
  const matchHint = hasTarget
    ? matchedCount && matchedCount > 0
      ? "按目标方向与技能匹配 · 准备度 " + readinessPercent + "%"
      : "完善技能与目标后生成匹配"
    : "先设置目标岗位，才能计算匹配";
  const gapHint =
    gapCount > 0
      ? (gapSkills.slice(0, 3).join(" · ") || "低于 Lv3 的技能") + (gapHours > 0 ? " · 约 " + gapHours + " 小时" : "")
      : "技能画像里没有低于 Lv3 的项";
  const canEnroll = hasTarget && gapCount > 0 && !enrolling;

  return (
    <Surface style={styles.card}>
      {/* 1) 匹配方向 */}
      <PressableScale
        haptic
        scaleTo={0.99}
        hitSlop={4}
        onPress={onOpenRadar}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={"匹配方向，匹配 " + matchValue + " 个岗位，打开岗位雷达"}
      >
        <View style={[styles.iconWrap, styles.iconPrimary]}>
          <ThemedIcon name="locate-outline" size={16} color={colors.primary} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>匹配方向</Text>
          <Text style={styles.rowHint} numberOfLines={2}>
            {matchHint}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.rowValue}>{matchValue}</Text>
          <ThemedIcon name="chevron-forward" size={13} color={colors.textMuted} />
        </View>
      </PressableScale>

      <View style={styles.divider} />

      {/* 2) 技能差距 → 生成学习任务（唯一写操作按钮） */}
      <View style={styles.row}>
        <View style={[styles.iconWrap, styles.iconWarn]}>
          <ThemedIcon name="construct-outline" size={16} color={colors.warning} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>技能差距</Text>
          <Text style={styles.rowHint} numberOfLines={2}>
            {gapHint}
          </Text>
        </View>
        <Text style={styles.rowValue}>{gapCount > 0 ? gapCount + " 项" : "—"}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canEnroll, busy: enrolling }}
        accessibilityLabel={enrolling ? "正在生成学习任务" : "把技能差距生成学习任务"}
        disabled={!canEnroll}
        hitSlop={4}
        onPress={() => {
          if (!canEnroll) return;
          haptics.light();
          onEnrollGaps();
        }}
        style={({ pressed }) => [
          styles.cta,
          !canEnroll && styles.ctaDisabled,
          pressed && canEnroll && styles.ctaPressed,
        ]}
      >
        {enrolling ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="add-circle-outline" size={15} color={canEnroll ? colors.primary : colors.textMuted} />
        )}
        <Text style={[styles.ctaText, !canEnroll && styles.ctaTextDisabled]}>
          {enrolling ? "正在生成…" : "把差距生成学习任务"}
        </Text>
      </Pressable>

      <View style={styles.divider} />

      {/* 3) 即将截止 */}
      <PressableScale
        haptic
        scaleTo={0.99}
        hitSlop={4}
        onPress={onOpenRadar}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={deadlines.length > 0 ? "即将截止的岗位 " + deadlines.length + " 个，打开岗位雷达" : "暂无即将截止的岗位"}
      >
        <View style={[styles.iconWrap, styles.iconAccent]}>
          <ThemedIcon name="hourglass-outline" size={16} color={colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>即将截止</Text>
          {deadlines.length > 0 ? (
            deadlines.map((item) => (
              <Text key={item.key} style={styles.deadlineLine} numberOfLines={1}>
                {item.deadlineLabel + " · " + item.title + "（" + item.company + "）"}
              </Text>
            ))
          ) : (
            <Text style={styles.rowHint}>最近没有带截止时间的岗位</Text>
          )}
        </View>
        <ThemedIcon name="chevron-forward" size={13} color={colors.textMuted} />
      </PressableScale>
    </Surface>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { padding: 0, overflow: "hidden" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 60,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
    },
    iconPrimary: { backgroundColor: colors.primarySoft },
    iconWarn: { backgroundColor: colors.warningSoft },
    iconAccent: { backgroundColor: colors.accentSoft },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    rowHint: { ...typography.meta, color: colors.textMuted },
    deadlineLine: { ...typography.meta, color: colors.textSecondary },
    rowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
    rowValue: { ...typography.hero, color: colors.text, ...tabularNums },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg + 32 + spacing.md },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 44,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primarySoft,
      backgroundColor: colors.primarySoft,
    },
    ctaPressed: { opacity: 0.75 },
    ctaDisabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
    ctaText: { ...typography.callout, fontWeight: "600", color: colors.primary },
    ctaTextDisabled: { color: colors.textMuted },
  });
