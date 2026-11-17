import { Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { AnimatedNumber } from "@/components/animated-number";
import { PressableScale } from "@/components/pressable-scale";
import { ProgressBar } from "@/components/stat";
import { ThemedIcon } from "@/components/themed-icon";
import type { SegmentOption } from "@/components/sheet";
import type { MarketDecisionPayload, MarketIntelligencePayload } from "@/lib/market";
import { aggregateTimeSeries, labelPositions } from "@/lib/market-series";
import { haptics } from "@/lib/haptics";
import { staggerDelay } from "@/lib/stagger";
import type { ThemeColors } from "@/theme/tokens";

import { makeStyles } from "./market-styles";

/**
 * 市场分析的局部小组件 / 常量 / 纯函数（从 app/market.tsx 原样搬出，逻辑与数值未改）。
 *
 * - FilterKey / FILTER_LABEL：筛选键与中文名（弹层标题/摘要共用一份）；
 * - RANGE_OPTIONS：时间范围滑动分段；
 * - maxOf：分布条归一化兜底；
 * - KpiCard / BarRow / Chip / TrendChart / MoveList：卡片内的小构件（styles 由父卡片传入）。
 */
export type MarketStyles = ReturnType<typeof makeStyles>;

export type FilterKey = "city" | "function" | "industry" | "seniority" | "source";

/** v16：筛选键的中文名（弹层标题/摘要共用一份，避免两处漂移） */
export const FILTER_LABEL: Record<FilterKey, string> = {
  city: "城市",
  function: "职能",
  industry: "行业",
  seniority: "资历",
  source: "来源",
};

/** v16：时间范围换成滑动分段（原 RangeTabs 的等权胶囊） */
export const RANGE_OPTIONS: SegmentOption[] = [
  { key: "7", label: "7天" },
  { key: "30", label: "30天" },
  { key: "90", label: "90天" },
];

export function maxOf(values: number[], fallback = 1) {
  return Math.max(fallback, ...values);
}

/** v20-C2：KPI 数字滚动（AnimatedNumber）；卡片去描边、tabular 对齐 */
export function KpiCard({
  styles,
  colors,
  icon,
  label,
  value,
  color,
}: {
  styles: MarketStyles;
  colors: ThemeColors;
  icon: Parameters<typeof ThemedIcon>[0]["name"];
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIcon, { backgroundColor: color + "22" }]}>
          <ThemedIcon name={icon} size={18} color={color} />
        </View>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      {typeof value === "number" ? (
        <AnimatedNumber value={value} style={styles.kpiValue} />
      ) : (
        <Text style={styles.kpiValue}>{value}</Text>
      )}
    </View>
  );
}

/** v20-C2：分布条动画化（stat.tsx 的 ProgressBar，240ms 缓动），替代静态 width% */
export function BarRow({
  styles,
  label,
  value,
  max,
  color,
  suffix,
}: {
  styles: MarketStyles;
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const safeMax = maxOf([max]);
  const clamped = Math.max(0.06, value / safeMax);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <ProgressBar progress={clamped} height={10} color={color} style={styles.rowFillTrack} />
      <Text style={styles.rowValue}>{suffix ? suffix : value}</Text>
    </View>
  );
}

/** v20-C6：筛选 chip 统一按压反馈 + 触觉（原先裸 Pressable） */
export function Chip({
  styles,
  label,
  active,
  onPress,
}: {
  styles: MarketStyles;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.94}
      style={[styles.chip, active && styles.chipActive]}
      onPress={
        onPress
          ? () => {
              haptics.soft();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressableScale>
  );
}

/**
 * v20-C2：趋势柱状图——入场错峰 + 换 range 时高度过渡（LinearTransition）；
 * 90 天档按周采样（≤31 根）防拥挤；末节点柱用 accent 高亮。
 */
export function TrendChart({ styles, series }: { styles: MarketStyles; series: MarketIntelligencePayload["timeSeries"] }) {
  /**
   * v1.31：真机反馈「胶囊柱状图与数字重合」—— 原来按 31 根柱采样，每根只有几 dp，
   * 日期标签必然互相压住。现在改为**按时间间隔聚合**（每 3 小时 / 每天 / 每 3 天…，
   * 柱数上限 10），并且只在前 5 个均匀位置渲染标签。
   * 聚合口径标在图表上方（用户要求"要标明"）；数据来源与接口口径未改，只做前端聚合。
   */
  const { buckets, intervalLabel, aggregated, rawCount } = aggregateTimeSeries(series ?? []);
  if (buckets.length === 0) {
    return <Text style={styles.trendEmpty}>还没有足够的样本，抓取几次后就能看到趋势。</Text>;
  }
  const max = Math.max(1, ...buckets.map((point) => point.value));
  const labels = labelPositions(buckets.length);
  const lastIndex = buckets.length - 1;
  return (
    <View>
      <Text style={styles.trendCaption}>
        {aggregated ? "按" + intervalLabel + "聚合" : "按原始时间粒度"} · {buckets.length} 柱 / {rawCount} 条记录
      </Text>
      <View style={styles.trendBars}>
        {buckets.map((point, index) => (
          <Animated.View
            key={point.key}
            style={styles.trendBarWrap}
            layout={LinearTransition}
            entering={FadeInDown.duration(240).delay(staggerDelay(index))}
          >
            <View style={styles.trendBarTrack}>
              <View
                style={[
                  styles.trendBar,
                  index === lastIndex ? styles.trendBarLast : null,
                  { height: Math.max(4, Math.round((point.value / max) * 82)) },
                ]}
              />
            </View>
            <Text style={styles.trendDate} numberOfLines={1}>
              {labels.has(index) ? point.label : ""}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

export function MoveList({ styles, items }: { styles: MarketStyles; items: MarketDecisionPayload["hotspots"] }) {
  return (
    <View style={styles.moveList}>
      {items.slice(0, 4).map((item) => (
        <View key={`${item.reason}-${item.key}`} style={styles.moveRow}>
          <View style={styles.moveMain}>
            <Text style={styles.moveName} numberOfLines={1}>{item.label}</Text>
            <Text style={styles.moveMeta}>{item.reason} · {item.count} 岗{item.medianSalary != null ? ` · ${item.medianSalary}K` : ""}</Text>
          </View>
          <Text style={styles.moveScore}>{Math.round(item.score)}</Text>
        </View>
      ))}
    </View>
  );
}
