import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Skeleton, SkeletonBlock, SkeletonCard, SkeletonList } from "@/components/skeleton";
import { useTheme } from "@/theme";
import { radius, spacing, type ThemeColors } from "@/theme/tokens";

/**
 * 成长页 / 数据看板的骨架屏（复用 components/skeleton 的统一骨架能力）。
 *
 * 约束：
 *  - 形状与真实内容对齐（成长页 = FoodNoms 仪表盘：页头 + 双列 + 通栏 + 双列 + 通栏 + 2×2），
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
      {/* 页头：INSIGHTS / 成长洞察 / 日期 */}
      <View style={styles.head}>
        <Skeleton variant="line" style={styles.kicker} />
        <Skeleton variant="line" style={styles.title} />
        <Skeleton variant="line" style={styles.sub} />
      </View>

      <View style={styles.grid}>
        <View style={styles.half}>
          <SkeletonBlock variant="card" style={styles.tallCard} />
        </View>
        <View style={styles.half}>
          <SkeletonBlock variant="card" style={styles.tallCard} />
        </View>
        <SkeletonBlock variant="chart" style={styles.fullChart} />
        <View style={styles.half}>
          <SkeletonBlock variant="card" style={styles.shortCard} />
        </View>
        <View style={styles.half}>
          <SkeletonBlock variant="card" style={styles.shortCard} />
        </View>
        <SkeletonBlock variant="card" style={styles.fullCard} />
      </View>

      <Skeleton variant="line" style={styles.sectionLine} />

      <View style={styles.grid}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.half}>
            <SkeletonBlock variant="card" style={styles.goalCard} />
          </View>
        ))}
      </View>

      <Skeleton variant="line" style={styles.sectionLine} />

      <View style={styles.quickRow}>
        {[0, 1, 2].map((index) => (
          <SkeletonBlock key={index} variant="line" style={styles.quick} />
        ))}
      </View>
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

    head: { gap: 7, paddingTop: 4 },
    kicker: { height: 10, width: 118 },
    title: { height: 30, width: 168, borderRadius: radius.sm },
    sub: { height: 11, width: 216 },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    half: { flexGrow: 1, flexBasis: "46%" },
    tallCard: { height: 168 },
    shortCard: { height: 136 },
    fullChart: { height: 188, width: "100%" },
    fullCard: { height: 152, width: "100%" },
    goalCard: { height: 122 },

    sectionLine: { height: 15, width: 96, marginTop: 4 },
    quickRow: { flexDirection: "row", gap: 8 },
    quick: { flex: 1, height: 64, borderRadius: radius.card },
  });
