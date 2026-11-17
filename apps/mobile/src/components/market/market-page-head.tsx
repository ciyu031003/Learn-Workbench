import { useMemo } from "react";
import { View } from "react-native";

import { ScreenHeaderLargeTitle } from "@/components/screen-header";
import { PressableScale } from "@/components/pressable-scale";
import { SheetSearchField, SheetSegmented } from "@/components/sheet";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";

import { makeStyles } from "./market-styles";
import { RANGE_OPTIONS } from "./market-widgets";

/**
 * ① 页头区：大标题（含样本数）+ 时间范围分段 + 搜索框。
 * 文案与交互口径与拆分前逐字一致（搜索提交/清空都回到页面模型的筛选回调）。
 */
export function MarketPageHead({
  summaryTotal,
  range,
  onRangeChange,
  search,
  onChangeSearch,
  onSubmitSearch,
  onClearSearch,
}: {
  summaryTotal: number | undefined;
  range: number | undefined;
  onRangeChange: (key: string) => void;
  search: string;
  onChangeSearch: (value: string) => void;
  onSubmitSearch: () => void;
  onClearSearch: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <>
      <ScreenHeaderLargeTitle
        title="市场分析"
        subtitle={`行业数据 · 趋势 · 个人位置${summaryTotal ? ` · ${summaryTotal} 个样本` : ""}`} />

      <SheetSegmented
        options={RANGE_OPTIONS}
        value={String(range ?? 90)}
        onChange={onRangeChange}
      />

      {/* v20-J4：搜索框收单源（SheetSearchField，内嵌清空）；清除时同步清掉 q 筛选 */}
      <View style={styles.searchRow}>
        <SheetSearchField
          value={search}
          onChangeText={onChangeSearch}
          placeholder="搜索职位 / 公司 / 技能"
          autoCapitalize="none"
          onSubmit={onSubmitSearch}
          onClear={onClearSearch}
          style={{ flex: 1 }}
        />
        <PressableScale accessibilityLabel="搜索" haptic scaleTo={0.92} style={styles.searchButton} onPress={onSubmitSearch}>
          <ThemedIcon name="search-outline" size={19} color="#FFFFFF" />
        </PressableScale>
      </View>
    </>
  );
}
