import { useMemo, useRef } from "react";
import Animated from "react-native-reanimated";
import { RefreshControl, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderStickyBar, useHeaderTopInset, useLargeTitleHeader } from "@/components/screen-header";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenBlurTarget } from "@/components/screen-blur-target";
import { GrowthDashboard } from "@/components/growth/growth-dashboard";
import { GrowthOverviewSkeleton } from "@/components/growth/growth-skeleton";
import { useGrowthData } from "@/components/growth/use-growth-data";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 成长（wellness）· FoodNoms 式洞察页（对齐 demo v12 renderGrowth）。
 *
 * 首屏就是完整仪表盘：连续记录 / 体重 / 宏量营养素 / 热量 / 每日目标 /
 * 四张状态环卡 / 快捷记录。取数与派生仍统一在 use-growth-data.ts；
 * 本文件只负责滚动容器、骨架屏与错误重试。
 */
export default function WellnessScreen() {
  const growth = useGrowthData();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const headerTop = useHeaderTopInset("hero");
  const wellnessScrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTopHandler("/wellness", wellnessScrollRef);

  const openInsights = () => router.push("/growth-insights" as never);

  return (
    <ScreenBlurTarget style={styles.root}>
      <ScreenHeaderStickyBar title="成长洞察" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        ref={wellnessScrollRef}
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...growth.control} />}
      >
        {growth.dailyFailed ? (
          <PressableScale
            haptic
            scaleTo={0.98}
            hitSlop={4}
            style={styles.errorBar}
            accessibilityRole="button"
            accessibilityLabel="重试加载成长数据"
            onPress={() => void growth.load()}
          >
            <ThemedIcon name="cloud-offline-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>
              {growth.data ? "刚才的数据没刷新成功，点这里重试" : "成长数据没加载出来，点这里重试"}
            </Text>
            <ThemedIcon name="refresh" size={16} color={colors.danger} />
          </PressableScale>
        ) : null}

        {growth.showSkeleton ? (
          <GrowthOverviewSkeleton />
        ) : (
          <GrowthDashboard growth={growth} onOpenInsights={openInsights} />
        )}
      </Animated.ScrollView>
    </ScreenBlurTarget>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg },
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      marginBottom: spacing.sm,
    },
    errorText: { flex: 1, ...typography.caption, fontWeight: "600", color: colors.danger },
  });

/** V7 上线护栏：本屏渲染异常时只兜住这一屏，不让整个 App 闪退。 */
export { ScreenErrorBoundary as ErrorBoundary } from "@/components/screen-error-boundary";
