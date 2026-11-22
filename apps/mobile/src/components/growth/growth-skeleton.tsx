import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Skeleton, SkeletonBlock, SkeletonCard, SkeletonList } from "@/components/skeleton";
import { useTheme } from "@/theme";
import { radius, spacing, type ThemeColors } from "@/theme/tokens";

/**
 * 成长页 / 数据看板的骨架屏（复用 components/skeleton 的统一骨架能力）。
 *
 * 约束：
 *  - 形状与真实内容对齐（概览层 = hero + 三个指标 + 一条周状态；数据看板 = hero + 分组卡 + 列表），
 *    骨架切换到内容时不出现高度跳变；
 *  - 不新写动画：呼吸 + 扫光全部来自 components/skeleton（那里已接减弱动态降级）；
 *  - 只在首轮真实请求结束前显示（判据见 use-growth-data.ts，不用固定 setTimeout）。
 */

export function GrowthOverviewSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View
      style={styles.wrap}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SkeletonBlock variant="hero" style={styles.hero} />
      <View style={styles.statRow}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.statCell}>
            <Skeleton variant="line" style={styles.statLabel} />
            <Skeleton variant="line" style={styles.statValue} />
          </View>
        ))}
      </View>
      <SkeletonBlock variant="chart" style={styles.weekBars} />
    </View>
  );
}

export function GrowthInsightsSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View
      style={styles.wrap}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SkeletonBlock variant="hero" style={styles.hero} />
      <SkeletonBlock variant="line" style={styles.sectionLine} />
      <SkeletonList count={2} />
      <SkeletonBlock variant="line" style={styles.sectionLine} />
      <SkeletonCard count={2} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.md },
    hero: { height: 208, borderRadius: radius.panel },
    statRow: { flexDirection: "row", gap: spacing.sm },
    statCell: {
      flex: 1,
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    statLabel: { height: 10, width: "52%" },
    statValue: { height: 18, width: "72%" },
    weekBars: { height: 84, borderRadius: radius.card },
    sectionLine: { height: 14, width: "34%", marginTop: spacing.sm },
  });
