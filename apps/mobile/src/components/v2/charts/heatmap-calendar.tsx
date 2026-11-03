import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { buildHeatmapMonth, heatAlpha, withAlpha, type HeatmapCell } from "@/lib/chart-math";
import { ChartHeader } from "./chart-header";
import { ActivityRings, type ActivityRingItem } from "./activity-rings";

/** 周一起（与 GitHub 贡献格一致；中文习惯的"一 … 日"） */
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;

/**
 * 月历热力格（BoardUI 活跃度日历）：周一起、每日小格按强度着色、Less→More 图例，
 * 右上角可选一枚小活动环。
 *
 * 网格与分档来自 `buildHeatmapMonth` / `heatLevel` / `heatAlpha`（都已单测）：
 * - 补位到 7 的倍数，直接按"周行 × 7 列"渲染；
 * - 任意非零值至少 1 档（有记录却和空白一样浅，用户会以为没记上）；
 * - 颜色 = 主色 × 档位透明度，深色模式下自动跟着 token 走。
 */
export function HeatmapCalendar({
  year,
  month,
  values,
  max,
  steps = 4,
  title,
  rings,
  onPressDay,
  showDayNumbers = false,
  style,
}: {
  year: number;
  /** 0 基月份（与 new Date 一致） */
  month: number;
  /** dateKey(YYYY-MM-DD) → 数值；缺省 = 无数据 */
  values?: Record<string, number>;
  /** 着色上界；缺省取本月最大值 */
  max?: number;
  steps?: number;
  title?: string | null;
  /** 右上角小活动环（可选） */
  rings?: ActivityRingItem[];
  onPressDay?: (key: string) => void;
  /** 是否在格子里显示日号（默认 false，保持热力图颗粒感） */
  showDayNumbers?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const grid = useMemo(
    () => buildHeatmapMonth({ year, month, values, max, steps }),
    [year, month, values, max, steps]
  );
  const rows = useMemo(() => {
    const out: (HeatmapCell | null)[][] = [];
    for (let i = 0; i < grid.cells.length; i += 7) out.push(grid.cells.slice(i, i + 7));
    return out;
  }, [grid]);
  const activeDays = grid.cells.filter((cell) => cell !== null && cell.level > 0).length;
  const legendLevels = Array.from({ length: steps + 1 }, (_, index) => index);
  const onStrong = dark ? colors.canvas : colors.surface;

  return (
    <View style={[styles.wrap, style]}>
      <ChartHeader
        title={title}
        right={
          rings && rings.length > 0 ? (
            <View style={styles.miniRings}>
              <ActivityRings rings={rings} size={44} thickness={5} gap={2} legend={false} />
            </View>
          ) : null
        }
      />

      <View style={styles.weekdays}>
        {WEEKDAYS.map((label) => (
          <Text key={label} style={styles.weekday} numberOfLines={1}>
            {label}
          </Text>
        ))}
      </View>

      {rows.map((row, weekIndex) => (
        <View key={`week-${weekIndex}`} style={styles.weekRow}>
          {row.map((cell, dayIndex) => {
            if (!cell) {
              return <View key={`pad-${weekIndex}-${dayIndex}`} style={styles.cellPad} />;
            }
            const background =
              cell.level === 0 ? colors.surfaceMuted : withAlpha(colors.primary, heatAlpha(cell.level, steps));
            const dayColor = cell.level >= 3 ? onStrong : colors.textFaint;
            return (
              <Pressable
                key={cell.key}
                onPress={onPressDay ? () => onPressDay(cell.key) : undefined}
                disabled={!onPressDay}
                accessibilityRole={onPressDay ? "button" : "text"}
                accessibilityLabel={`${cell.key} ${cell.level > 0 ? `强度 ${cell.level}` : "无记录"}`}
                style={[styles.cell, { backgroundColor: background }]}
              >
                {showDayNumbers ? (
                  <Text style={[styles.cellDay, { color: dayColor }]} numberOfLines={1}>
                    {cell.day}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText} numberOfLines={1}>
          {activeDays > 0 ? `${activeDays} 天有记录` : "本月暂无记录"}
        </Text>
        <View style={styles.legend}>
          <Text style={styles.footerText}>Less</Text>
          {legendLevels.map((level) => (
            <View
              key={`swatch-${level}`}
              style={[
                styles.swatch,
                {
                  backgroundColor:
                    level === 0 ? colors.surfaceMuted : withAlpha(colors.primary, heatAlpha(level, steps)),
                },
              ]}
            />
          ))}
          <Text style={styles.footerText}>More</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: "100%" },
    miniRings: { width: 44 },
    weekdays: { flexDirection: "row", gap: spacing.xs, marginBottom: 6 },
    weekday: { ...typography.caption, fontWeight: "400", color: colors.textFaint, flex: 1, textAlign: "center" },
    weekRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
    cell: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: radius.sm / 2,
      alignItems: "center",
      justifyContent: "center",
    },
    cellPad: { flex: 1, aspectRatio: 1 },
    cellDay: { ...typography.caption, fontWeight: "500" },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.xs,
      gap: spacing.sm,
    },
    footerText: { ...typography.meta, color: colors.textMuted },
    legend: { flexDirection: "row", alignItems: "center", gap: 4 },
    swatch: { width: 10, height: 10, borderRadius: 3 },
  });
