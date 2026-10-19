import { useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import { exerciseTypeLabels } from "@learn-workbench/shared/labels";
import { ChipGroup } from "@/components/sheet";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { sportColorsOf } from "@/lib/sport-view";
import {
  buildSportTrend,
  formatSportDuration,
  type SportLogLike,
  type SportTrendFilter,
} from "@/lib/sport-trend";

/**
 * 运动趋势卡（v1.45 全屏趋势页第二段）。
 *
 * 数据是本地 store 的 `sports`（计时结束写入 / 手动补录），**零后端请求**；
 * 画法与 `calorie-trend.tsx` 同源（自绘 react-native-svg 柱状 + onLayout 量宽），
 * 但不复用它的平滑折线 —— 运动时长按天是"离散计量"，柱状比曲线更诚实。
 *
 * 三个交互：
 *  - 7 / 30 天窗口切换（只换聚合窗口，不重新取数）；
 *  - 按运动大类筛选（`ExerciseType`），分组明细始终展示窗口内**全部**类型，
 *    避免点进某个类型后切不回去；
 *  - 顶部给区间合计（时长 / 次数 / 有记录天数）。
 */
function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };
  return { width, onLayout };
}

export function SportTrendCard({
  logs,
  endKey,
  style,
}: {
  /** 本地 store 的运动记录（`sports`） */
  logs: SportLogLike[];
  /** 窗口右端（通常是今天） */
  endKey: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, onLayout } = useMeasuredWidth();
  const [days, setDays] = useState<7 | 30>(7);
  const [filter, setFilter] = useState<SportTrendFilter>("ALL");

  const series = useMemo(() => buildSportTrend(logs, endKey, days, filter), [logs, endKey, days, filter]);
  const hasAnyLog = series.byType.length > 0;
  const hasRangeData = series.totalSessions > 0;

  const height = 156;
  const topPad = 14;
  const bottomPad = 22;
  const leftPad = 4;
  const rightPad = 4;
  const plotW = Math.max(1, width - leftPad - rightPad);
  const plotH = Math.max(30, height - topPad - bottomPad);
  const n = series.points.length;
  const slot = plotW / Math.max(1, n);
  const barW = Math.max(3, Math.min(24, slot * 0.62));
  const maxValue = Math.max(1, series.peakMinutes);
  /** 柱高：0 分钟也留 2px 底痕，让人看得出"这一天存在、只是没运动" */
  const barHeight = (minutes: number) =>
    minutes <= 0 ? 2 : Math.max(3, (Math.min(1, minutes / maxValue) || 0) * plotH);
  const labelStep = days === 7 ? 1 : 5;
  const palette = filter === "ALL" ? { c1: colors.accent, c2: colors.accentSoft } : sportColorsOf(filter);

  const filterOptions = useMemo(
    () =>
      series.byType.map((t) => ({
        key: t.type,
        label: exerciseTypeLabels[t.type],
        badge: t.sessions,
      })),
    [series.byType]
  );

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Text style={styles.title}>近 {days} 天运动</Text>
          <Text style={styles.total}>
            {formatSportDuration(series.totalMinutes)}
          </Text>
        </View>
        <View style={styles.headRight}>
          <Text style={styles.statLine}>
            共 <Text style={styles.statStrong}>{series.totalSessions}</Text> 次
          </Text>
          <Text style={styles.statLine}>
            <Text style={styles.statStrong}>{series.activeDays}</Text> / {days} 天有记录
          </Text>
          {series.peakKey ? (
            <Text style={styles.statLine}>
              单日峰值 <Text style={styles.statStrong}>{series.peakMinutes}</Text> 分
            </Text>
          ) : null}
        </View>
      </View>

      {hasAnyLog ? (
        <ChipGroup
          options={filterOptions}
          selected={[filter]}
          onToggle={(key) => setFilter(key as SportTrendFilter)}
          multiple={false}
          wrap
          allKey="ALL"
          allLabel="全部"
        />
      ) : null}

      {hasRangeData ? (
        <View style={{ height }} onLayout={onLayout}>
          {width > 0 ? (
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="sportTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={palette.c1} />
                  <Stop offset="1" stopColor={palette.c2} />
                </LinearGradient>
              </Defs>
              {series.points.map((p, i) => {
                const h = barHeight(p.minutes);
                const x = leftPad + slot * i + (slot - barW) / 2;
                return (
                  <Rect
                    key={p.key}
                    x={x}
                    y={topPad + plotH - h}
                    width={barW}
                    height={h}
                    rx={Math.min(barW / 2, 6)}
                    fill={p.sessions > 0 ? "url(#sportTrendFill)" : colors.surfaceMuted}
                    opacity={p.sessions > 0 ? 1 : 0.55}
                  />
                );
              })}
              {series.points.map((p, i) =>
                i % labelStep === 0 || i === n - 1 ? (
                  <SvgText
                    key={`l-${p.key}`}
                    x={leftPad + slot * i + slot / 2}
                    y={height - 6}
                    fontSize={9}
                    fill={p.key === endKey ? colors.accentStrong : colors.textFaint}
                    textAnchor="middle"
                  >
                    {p.label}
                  </SvgText>
                ) : null
              )}
            </Svg>
          ) : null}
        </View>
      ) : (
        <View style={styles.empty}>
          <ThemedIcon name="walk-outline" size={22} color={colors.textFaint} />
          <Text style={styles.emptyText}>
            {hasAnyLog ? `近 ${days} 天没有这类运动的记录` : "还没有运动记录，用下面的「补录」加一条试试"}
          </Text>
        </View>
      )}

      {hasAnyLog ? (
        <View style={styles.typeList}>
          {series.byType.map((t) => (
            <View key={t.type} style={styles.typeRow}>
              <View style={[styles.dot, { backgroundColor: sportColorsOf(t.type).c1 }]} />
              <Text style={styles.typeName}>{exerciseTypeLabels[t.type]}</Text>
              <Text style={styles.typeValue}>{formatSportDuration(t.minutes)}</Text>
              <Text style={styles.typeSessions}>{t.sessions} 次</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerHint}>数据来自本机运动记录（计时结束自动写入 + 手动补录）</Text>
        <View style={styles.rangeToggle}>
          {([7, 30] as const).map((d) => (
            <Text
              key={d}
              onPress={() => setDays(d)}
              style={[styles.rangeItem, days === d && styles.rangeItemActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: days === d }}
            >
              {d} 天
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 14,
      borderRadius: 20,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 10,
    },
    head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    headLeft: { flex: 1, minWidth: 0, gap: 2 },
    headRight: { alignItems: "flex-end", gap: 2 },
    title: { ...typography.headline, color: colors.text },
    total: { ...typography.title1, color: colors.accentStrong, ...tabularNums },
    statLine: { ...typography.micro, color: colors.textMuted, fontWeight: "500", ...tabularNums },
    statStrong: { color: colors.text, fontWeight: "800" },
    empty: { alignItems: "center", gap: 6, paddingVertical: 22 },
    emptyText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
    typeList: { gap: 6, paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    typeRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    typeName: { ...typography.caption, color: colors.text, fontWeight: "700", flex: 1, minWidth: 0 },
    typeValue: { ...typography.caption, color: colors.text, fontWeight: "800", ...tabularNums },
    typeSessions: { ...typography.micro, color: colors.textMuted, fontWeight: "600", width: 46, textAlign: "right", ...tabularNums },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    footerHint: { ...typography.micro, fontSize: 9, color: colors.textFaint, fontWeight: "500", flex: 1, minWidth: 0 },
    rangeToggle: { flexDirection: "row", gap: 4 },
    rangeItem: {
      ...typography.micro,
      color: colors.textMuted,
      overflow: "hidden",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surfaceMuted,
    },
    rangeItemActive: { backgroundColor: colors.accentSoft, color: colors.accentStrong, fontWeight: "800" },
  });
