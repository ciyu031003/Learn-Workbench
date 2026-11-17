import { useMemo } from "react";
import { Text, View } from "react-native";

import { ThemedIcon } from "@/components/themed-icon";
import { Surface } from "@/components/surface";
import { radius } from "@/theme/tokens";
import { useTheme } from "@/theme";
import type { RadarOverview } from "@/lib/radar-filter";

import { makeStyles } from "./radar-styles";
import { Stat } from "./radar-widgets";

/**
 * 概览卡：雷达概览（本屏唯一 glassStrong 锚点）+ 四个统计格 + 城市/方向 Top3 + fallback 说明。
 * 数据全部由页面模型提供，组件内只做展示。
 */
export function RadarOverviewCard({
  overview,
  fallback,
}: {
  overview: RadarOverview;
  fallback: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Surface tier="glassStrong" corner={radius.panel} style={styles.overviewCard}>
      <View style={styles.overviewHead}>
        <View style={styles.overviewTitleRow}>
          <ThemedIcon name="radio-outline" size={15} color={colors.primary} />
          <Text style={styles.overviewTitle}>雷达概览</Text>
        </View>
        <Text style={styles.overviewUpdated} numberOfLines={1}>{overview.updatedLabel}</Text>
      </View>

      <View style={styles.statRow}>
        <Stat styles={styles} value={overview.matchedTotal} label="匹配岗位" highlight />
        <Stat styles={styles} value={overview.scanned} label="已扫描" />
        <Stat styles={styles} value={overview.favoriteCount} label="已收藏" />
        <Stat styles={styles} value={overview.applicationCount} label="已投递" />
      </View>

      <View style={styles.distRow}>
        <Text style={styles.distLabel}>城市 Top3</Text>
        <View style={styles.distChips}>
          {overview.topCities.length > 0 ? (
            overview.topCities.map((item) => (
              <View key={item.city} style={styles.distChip}>
                <Text style={styles.distChipText} numberOfLines={1}>
                  {item.city} {item.count}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.distEmpty}>暂无城市分布</Text>
          )}
        </View>
      </View>

      <View style={styles.distRow}>
        <Text style={styles.distLabel}>方向 Top3</Text>
        <View style={styles.distChips}>
          {overview.topCategories.length > 0 ? (
            overview.topCategories.map((item) => (
              <View key={item.category} style={styles.distChip}>
                <Text style={styles.distChipText} numberOfLines={1}>
                  {item.label} {item.count}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.distEmpty}>暂无方向分布</Text>
          )}
        </View>
      </View>

      {fallback ? (
        <Text style={styles.overviewNote}>当前按城市推荐（未完善画像，匹配度按岗位方向与技能近似估算）</Text>
      ) : null}
    </Surface>
  );
}
