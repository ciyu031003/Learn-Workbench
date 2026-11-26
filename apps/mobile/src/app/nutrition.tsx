import { useCallback, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { takeNavPendingParams } from "@/lib/nav-pending";
import { isDateKey } from "@/lib/nutrition-stats";
import { todayAndYesterday } from "@/lib/nutrition-views";
import { makeNutritionStyles } from "@/components/nutrition/nutrition-styles";
import { AddFoodSheet } from "@/components/nutrition/add-food-sheet";
import { NutritionSheetsA } from "@/components/nutrition/nutrition-sheets-a";
import { NutritionSheetsB } from "@/components/nutrition/nutrition-sheets-b";
import { V15NutritionDashboard } from "@/components/nutrition/v15-nutrition-dashboard";
import { useNutritionScreen } from "@/lib/nutrition/use-nutrition-screen";
import { useV15 } from "@/components/v15/v15-theme";
import { V15Scroll } from "@/components/v15/v15-ui";
import { useTheme } from "@/theme";
import type { MealKind } from "@learn-workbench/shared/schemas";

/**
 * 今日饮食（V15）。
 *
 * 展示层完全按 demo v12 renderNutrition 重做：周条 → 能量环 → 餐次卡 → 7 天热量
 * → 饮水 → 常吃 → 洞察。数据 / 发件箱 / 编辑 / 目标 / 饮水逻辑仍沿用
 * use-nutrition-screen，未改业务口径。新增食物改为全屏 /nutrition-add。
 */
export default function NutritionScreen() {
  const { colors } = useTheme();
  const v15 = useV15();
  const styles = useMemo(() => makeNutritionStyles(colors), [colors]);
  const params = useLocalSearchParams<{ stats?: string; date?: string }>();
  const [override, setOverride] = useState<Record<string, string> | null>(null);

  useFocusEffect(
    useCallback(() => {
      const pending = takeNavPendingParams("nutrition");
      if (pending) setOverride(pending);
    }, [])
  );

  const effective = override ?? params;
  const { today: todayKey } = useMemo(() => todayAndYesterday(), []);
  const initialDate = isDateKey(effective.date) ? effective.date : todayKey;
  const model = useNutritionScreen({ initialDate });
  const { control } = usePullRefresh(model.load);
  // 从全屏添加页返回时刷新（含首次进入；首轮重复请求无副作用）
  useFocusRefresh(model.load);

  const openAdd = useCallback(
    (meal?: MealKind) => {
      const nextMeal = meal ?? model.meal;
      if (meal) model.setMeal(meal);
      router.push({ pathname: "/nutrition-add", params: { date: model.date, meal: nextMeal } } as never);
    },
    [model]
  );

  const openTrends = useCallback(() => router.push("/trends" as never), []);

  return (
    <View style={{ flex: 1, backgroundColor: v15.canvas }}>
      <V15Scroll p={v15} refreshControl={<RefreshControl {...control} />}>
        <V15NutritionDashboard model={model} onOpenAdd={openAdd} onOpenTrends={openTrends} />
      </V15Scroll>

      <NutritionSheetsA model={model} styles={styles} colors={colors} />
      <AddFoodSheet model={model} styles={styles} colors={colors} />
      <NutritionSheetsB model={model} styles={styles} colors={colors} />
    </View>
  );
}
