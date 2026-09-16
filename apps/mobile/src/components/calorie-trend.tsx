import { useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { buildSmoothPath } from "@/components/charts";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { buildHeatmapWeeks, buildTrendSeries, formatDelta, type HeatLevel } from "@/lib/nutrition-stats";
import { groupThousands, type DaySummaryRow } from "@/lib/nutrition-views";
import { fromDateKey } from "@learn-workbench/shared";

/**
 * 饮食进阶可视化（v4 P4-c）——复刻「吃一点」的 Calorie Stats 两张图：
 *  ① 近 7 天热量曲线：橙线 + 面积渐隐 + 上周虚线对比 + 日均/峰值标注（参考图 6 的 "Last 7 Days"）
 *  ② 近 6 个月点阵热力图：列=周、行=星期，深浅表示当天摄入档位（参考图 6 的 "Last 6 Months"）
 *
 * 两个组件都是**纯展示**：数据由调用方（趋势弹层）按需拉好后传进来。
 * 为什么不用现成的 `LineChart`：它只支持单序列，而这里要"本周实线 + 上周虚线"双序列，
 * 且要在图上写"日均/峰值"标注 —— 只复用它的 `buildSmoothPath`，渲染自己来。
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

export function CalorieTrendCard({
  map,
  endKey,
  targetKcal = 0,
  style,
}: {
  /** 逐日汇总（窗口 ≥ 14 天时"上周对比"才有数据） */
  map: Record<string, DaySummaryRow>;
  /** 曲线右端（通常是今天） */
  endKey: string;
  targetKcal?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, onLayout } = useMeasuredWidth();
  /** 展示口径默认"近 7 天"，数据够时可以直接看近 14 天（不是新请求，只换窗口） */
  const [days, setDays] = useState<7 | 14>(7);

  const series = useMemo(() => buildTrendSeries(map, endKey, days), [map, endKey, days]);
  const hasData = series.totalKcal > 0 || series.priorTotalKcal > 0;

  const height = 168;
  const topPad = 26;
  const bottomPad = 26;
  const leftPad = 10;
  const rightPad = 10;
  const plotW = Math.max(1, width - leftPad - rightPad);
  const plotH = Math.max(30, height - topPad - bottomPad);
  const maxValue = Math.max(
    1,
    ...series.current.map((p) => p.kcal),
    ...series.prior,
    targetKcal > 0 ? targetKcal : 0
  );

  const x = (i: number) => leftPad + (series.current.length <= 1 ? plotW / 2 : (plotW * i) / (series.current.length - 1));
  const y = (v: number) => topPad + plotH - (v <= 0 ? 0 : Math.min(1, v / maxValue) * plotH);

  const linePts = series.current.map((p, i) => ({ x: x(i), y: y(p.kcal) }));
  const linePath = buildSmoothPath(linePts);
  const areaPath = linePts.length
    ? `${linePath} L ${linePts[linePts.length - 1].x} ${topPad + plotH} L ${linePts[0].x} ${topPad + plotH} Z`
    : "";

  // 上周虚线：只有长度与本周一致时才画，避免"7 天 vs 14 天"两条线错位比较
  const priorPts = series.prior.map((v, i) => ({
    x: leftPad + (series.prior.length <= 1 ? plotW / 2 : (plotW * i) / (series.prior.length - 1)),
    y: y(v),
  }));
  const priorPath = series.prior.some((v) => v > 0) ? buildSmoothPath(priorPts) : "";
  const targetY = targetKcal > 0 ? y(targetKcal) : null;

  const deltaText = formatDelta(series.deltaPct);
  const peakLabel = series.peakKey
    ? `${fromDateKey(series.peakKey).getMonth() + 1}/${fromDateKey(series.peakKey).getDate()}`
    : null;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Text style={styles.title}>近 {days} 天</Text>
          <Text style={styles.total}>
            {groupThousands(series.totalKcal)}
            <Text style={styles.totalUnit}> kcal</Text>
          </Text>
          {deltaText ? (
            <Text style={[styles.delta, (series.deltaPct ?? 0) > 0 ? styles.deltaUp : styles.deltaDown]}>{deltaText}</Text>
          ) : (
            <Text style={styles.deltaMuted}>暂无上一周期数据可对比</Text>
          )}
        </View>
        <View style={styles.headRight}>
          <Text style={styles.statLine}>
            日均 <Text style={styles.statStrong}>{series.avgKcal}</Text> kcal
          </Text>
          <Text style={styles.statLine}>
            峰值 <Text style={styles.statStrong}>{series.peakKcal}</Text> kcal
            {peakLabel ? `（${peakLabel}）` : ""}
          </Text>
          <Text style={styles.statLine}>
            {series.daysLogged} / {days} 天有记录
          </Text>
        </View>
      </View>

      {hasData ? (
        <View style={{ height }} onLayout={onLayout}>
          {width > 0 ? (
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="kcalTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.accent} stopOpacity={0.34} />
                  <Stop offset="1" stopColor={colors.accent} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>

              {/* 目标线：一眼看出"这周整体高于/低于目标" */}
              {targetY !== null ? (
                <>
                  <Path
                    d={`M ${leftPad} ${targetY} L ${leftPad + plotW} ${targetY}`}
                    stroke={colors.borderStrong}
                    strokeWidth={1}
                    strokeDasharray="2 5"
                  />
                  <SvgText x={leftPad + 2} y={targetY - 4} fontSize={9} fill={colors.textFaint}>
                    目标 {targetKcal}
                  </SvgText>
                </>
              ) : null}

              {areaPath ? <Path d={areaPath} fill="url(#kcalTrendFill)" /> : null}
              {priorPath ? (
                <Path
                  d={priorPath}
                  fill="none"
                  stroke={colors.textFaint}
                  strokeWidth={1.6}
                  strokeDasharray="4 4"
                  opacity={0.7}
                />
              ) : null}
              {linePath ? (
                <Path d={linePath} fill="none" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              ) : null}

              {linePts.map((p, i) => (
                <Circle
                  key={series.current[i].key}
                  cx={p.x}
                  cy={p.y}
                  r={series.current[i].key === endKey ? 4.5 : 2.6}
                  fill={series.current[i].logged ? colors.surfaceStrong : colors.surfaceMuted}
                  stroke={colors.accent}
                  strokeWidth={series.current[i].key === endKey ? 2.5 : 1.8}
                />
              ))}

              {series.current.map((p, i) =>
                days === 7 || i % 3 === 0 || i === series.current.length - 1 ? (
                  <SvgText
                    key={`l-${p.key}`}
                    x={linePts[i].x}
                    y={height - 8}
                    fontSize={9}
                    fill={p.key === endKey ? colors.accentStrong : colors.textFaint}
                    textAnchor="middle"
                  >
                    {days === 7 ? p.label : `${fromDateKey(p.key).getMonth() + 1}/${fromDateKey(p.key).getDate()}`}
                  </SvgText>
                ) : null
              )}
            </Svg>
          ) : null}
        </View>
      ) : (
        <View style={styles.empty}>
          <ThemedIcon name="pulse-outline" size={22} color={colors.textFaint} />
          <Text style={styles.emptyText}>还没有足够的数据画曲线，先记两条饮食吧</Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.legend}>
          <View style={[styles.legendLine, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>本期</Text>
          <View style={[styles.legendLine, styles.legendDashed, { borderColor: colors.textFaint }]} />
          <Text style={styles.legendText}>上一周期</Text>
        </View>
        <View style={styles.rangeToggle}>
          {([7, 14] as const).map((d) => (
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

/** 与纯逻辑里同一套分档，组件内联一份避免为了取色再走一次函数对象 */

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
    totalUnit: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
    subtle: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    delta: { ...typography.micro },
    deltaUp: { color: colors.danger },
    deltaDown: { color: colors.success },
    deltaMuted: { ...typography.micro, color: colors.textFaint, fontWeight: "500" },
    statLine: { ...typography.micro, color: colors.textMuted, fontWeight: "500", ...tabularNums },
    statStrong: { color: colors.text, fontWeight: "800" },
    empty: { alignItems: "center", gap: 6, paddingVertical: 22 },
    emptyText: { ...typography.caption, color: colors.textMuted },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    legend: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendLine: { width: 14, height: 3, borderRadius: 2 },
    legendDashed: { backgroundColor: "transparent", borderTopWidth: 2, borderStyle: "dashed", height: 0 },
    legendText: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
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
    heatWrap: { paddingTop: 2 },
    heatInner: { flexDirection: "row", alignItems: "flex-start" },
    heatLabels: { justifyContent: "flex-start" },
    heatLabel: { ...typography.micro, fontSize: 9, color: colors.textFaint, fontWeight: "500" },
    monthRow: { height: 12, position: "relative" },
    monthLabel: { position: "absolute", ...typography.micro, fontSize: 9, color: colors.textFaint, fontWeight: "600" },
    heatGrid: { flexDirection: "row" },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendCell: { width: 10, height: 10, borderRadius: 3 },
    legendHint: { ...typography.micro, fontSize: 9, color: colors.textFaint, fontWeight: "500", marginLeft: "auto" },
  });
