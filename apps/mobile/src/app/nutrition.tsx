import { useEffect, useMemo } from "react";
import { RefreshControl, View } from "react-native";
import Animated from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { spacing } from "@/theme/tokens";
import { isDateKey } from "@/lib/nutrition-stats";
import { todayAndYesterday } from "@/lib/nutrition-views";
import { makeNutritionStyles } from "@/components/nutrition/nutrition-styles";
import { AddFoodSheet } from "@/components/nutrition/add-food-sheet";
import { NutritionBody } from "@/components/nutrition/nutrition-body";
import { NutritionOverview } from "@/components/nutrition/nutrition-overview";
import { NutritionSheetsA } from "@/components/nutrition/nutrition-sheets-a";
import { NutritionSheetsB } from "@/components/nutrition/nutrition-sheets-b";
import { useNutritionScreen } from "@/lib/nutrition/use-nutrition-screen";

/**
 * 今日饮食（S6-4 拆分后）：本文件只做「主题 + 导航 + 组合」。
 * 数据层：lib/nutrition/use-nutrition-screen.ts；展示层：components/nutrition/*；
 * 纯逻辑：lib/nutrition/{derive,portion-memo,constants}.ts（均有单测）。
 */
export default function NutritionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeNutritionStyles(colors), [colors]);
  const params = useLocalSearchParams<{ stats?: string; date?: string }>();
  const { today: todayKey } = useMemo(() => todayAndYesterday(), []);
  const initialDate = isDateKey(params.date) ? params.date : todayKey;
  const model = useNutritionScreen({ initialDate });
  const headerScroll = useLargeTitleHeader();
  /** 子页（Stack push）底部只拿到 insets.bottom，可能是 0（3 键导航更高）；额外留 spacing.lg 呼吸位避免贴边 */
  const tabBarSpace = useTabBarSpace(spacing.lg);
  const { control } = usePullRefresh(model.load, { stickyHeader: true });

  useEffect(() => {
    if (params.stats === "1") router.replace("/trends" as never);
  }, [params.stats]);

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title={model.isToday ? "今日饮食" : "饮食记录"} scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...control} />}
      >
        <ScreenHeaderLargeTitle
          title={model.isToday ? "今日饮食" : "饮食记录"}
          subtitle={
            model.isToday
              ? "已记录 " + model.entries.length + " 条 · 目标 " + model.target.kcal + " kcal"
              : model.date + " · " + model.entries.length + " 条"
          }
        />
        <NutritionOverview model={model} styles={styles} colors={colors} />
        <NutritionBody model={model} styles={styles} colors={colors} />
        <NutritionSheetsA model={model} styles={styles} colors={colors} />
        <AddFoodSheet model={model} styles={styles} colors={colors} />
        <NutritionSheetsB model={model} styles={styles} colors={colors} />
      </Animated.ScrollView>
    </View>
  );
}
