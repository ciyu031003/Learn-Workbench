import { useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { buildHeatmapWeeks, type HeatLevel } from "@/lib/nutrition-stats";
import { groupThousands, type DaySummaryRow } from "@/lib/nutrition-views";

/**
 * 饮食进阶可视化（v4 P4-c → v2.2 只保留热力图）：
 * 「近 6 个月」点阵热力图：列=周、行=星期，深浅表示当天摄入档位。
 *
 * 原「近 7 天热量曲线」（CalorieTrendCard）在 trends.tsx 改画 AreaChart 后已无引用，
 * 随组件一并移除（buildTrendSeries / formatDelta 仍由 trends.tsx 与单测使用）。
 * 热力图是**纯展示**：数据由调用方（趋势页）按需拉好后传进来。
 */

/** 用 onLayout 拿宽度（与 charts.tsx 的 useChartWidth 同思路，但该 hook 未导出，避免改动它） */
function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };
  return { width, onLayout };
}

/** 点阵档位 → 颜色（0 档用极浅底，让"没记录"也能看出格子位置） */
function heatColors(colors: ThemeColors): string[] {
  return [
    colors.surfaceMuted,
    "rgba(242,140,40,0.22)",
    "rgba(242,140,40,0.42)",
    "rgba(242,140,40,0.66)",
    colors.accentStrong,
  ];
}

export function CalorieHeatmapCard({
  map,
  endKey,
  targetKcal = 0,
  weeks = 26,
  style,
}: {
  map: Record<string, DaySummaryRow>;
  endKey: string;
  targetKcal?: number;
  /** 列数（26 周 ≈ 6 个月） */
  weeks?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, onLayout } = useMeasuredWidth();

  const data = useMemo(
    () => buildHeatmapWeeks(map, endKey, weeks, targetKcal > 0 ? targetKcal : 0),
    [map, endKey, weeks, targetKcal]
  );
  const palette = heatColors(colors);
  /** 用实际列数（`weeks` 会被纯逻辑夹到 1..53，直接用入参会与网格错位） */
  const cols = data.weeks.length;

  // 单元格尺寸按容器宽度自适应：列间隔 3pt，左侧留一点给星期标签
  const gap = 3;
  const labelW = 18;
  const cell = width > 0 ? Math.max(4, Math.floor((width - labelW - gap * (cols - 1)) / cols)) : 6;
  const gridW = cols * cell + gap * (cols - 1);

  const levels: HeatLevel[] = [0, 1, 2, 3, 4];

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Text style={styles.title}>近 6 个月</Text>
          <Text style={styles.subtle}>
            {data.loggedDays > 0 ? `记录了 ${data.loggedDays} 天` : "还没有记录"}
            {data.maxKcal > 0 ? ` · 单日最高 ${groupThousands(data.maxKcal)} kcal` : ""}
          </Text>
        </View>
      </View>

      {data.loggedDays > 0 ? (
        <View onLayout={onLayout} style={styles.heatWrap}>
          {width > 0 ? (
            <View style={styles.heatInner}>
              <View style={[styles.heatLabels, { width: labelW }]}>
                {["日", "", "二", "", "四", "", "六"].map((t, i) => (
                  <Text key={i} style={[styles.heatLabel, { height: cell, lineHeight: cell }]}>
                    {t}
                  </Text>
                ))}
              </View>
              <View>
                <View style={[styles.monthRow, { width: gridW, marginLeft: 0 }]}>
                  {data.monthLabels.map((m) => (
                    <Text
                      key={`${m.column}-${m.label}`}
                      style={[styles.monthLabel, { left: m.column * (cell + gap) }]}
                    >
                      {m.label}
                    </Text>
                  ))}
                </View>
                <View style={[styles.heatGrid, { width: gridW }]}>
                  {data.weeks.map((column, ci) => (
                    <View key={ci} style={{ width: cell, marginRight: ci === data.weeks.length - 1 ? 0 : gap }}>
                      {column.map((c, ri) => (
                        <View
                          key={c.key}
                          style={{
                            width: cell,
                            height: cell,
                            borderRadius: Math.max(2, Math.round(cell * 0.28)),
                            // 每列最后一行的格不再留底边距，否则网格整体会多出一个 gap
                            marginBottom: ri === column.length - 1 ? 0 : gap,
                            backgroundColor: !c.inRange ? "transparent" : palette[c.level],
                          }}
                          accessibilityLabel={
                            c.inRange ? `${c.key}${c.kcal > 0 ? ` 摄入 ${c.kcal} 千卡` : " 没有记录"}` : undefined
                          }
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.empty}>
          <ThemedIcon name="grid-outline" size={22} color={colors.textFaint} />
          <Text style={styles.emptyText}>最近半年还没有饮食记录</Text>
        </View>
      )}

      <View style={styles.legendRow}>
        <Text style={styles.legendText}>少</Text>
        {levels.map((lv) => (
          <View key={lv} style={[styles.legendCell, { backgroundColor: palette[lv] }]} />
        ))}
        <Text style={styles.legendText}>多</Text>
        <Text style={styles.legendHint}>
          {targetKcal > 0 ? `按目标 ${targetKcal} kcal 分档` : "按区间峰值分档"}
        </Text>
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
    title: { ...typography.headline, color: colors.text },
    subtle: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    empty: { alignItems: "center", gap: 6, paddingVertical: 22 },
    emptyText: { ...typography.caption, color: colors.textMuted },
    heatWrap: { paddingTop: 2 },
    heatInner: { flexDirection: "row", alignItems: "flex-start" },
    heatLabels: { justifyContent: "flex-start" },
    heatLabel: { ...typography.micro, fontSize: 9, color: colors.textFaint, fontWeight: "500" },
    monthRow: { height: 12, position: "relative" },
    monthLabel: { position: "absolute", ...typography.micro, fontSize: 9, color: colors.textFaint, fontWeight: "600" },
    heatGrid: { flexDirection: "row" },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendCell: { width: 10, height: 10, borderRadius: 3 },
    legendText: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    legendHint: { ...typography.micro, fontSize: 9, color: colors.textFaint, fontWeight: "500", marginLeft: "auto" },
  });
