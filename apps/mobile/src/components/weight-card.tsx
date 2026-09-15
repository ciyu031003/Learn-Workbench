import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { ThemedIcon } from "@/components/themed-icon";
import { AnimatedNumber } from "@/components/animated-number";
import { haptics } from "@/lib/haptics";
import { bmiLabel, computeBmi, movingAverage, weightDelta, weightDeltaText, type WeightPoint } from "@/lib/body-metrics";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

const CHART_W = 120;
const CHART_H = 44;

/** 迷你趋势线：原始点（细）+ 均线（粗）；按实际区间缩放（不是 0 基线） */
function WeightSparkline({ values, color, avgColor }: { values: number[]; color: string; avgColor: string }) {
  const geom = useMemo(() => {
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(0.4, (max - min) * 0.25);
    const lo = min - pad;
    const hi = max + pad;
    const span = Math.max(0.01, hi - lo);
    const toY = (v: number) => CHART_H - ((v - lo) / span) * CHART_H;
    const toX = (i: number) => (values.length === 1 ? CHART_W / 2 : (CHART_W * i) / (values.length - 1));
    const toPath = (vals: number[]) =>
      vals.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
    return {
      raw: toPath(values),
      avg: toPath(movingAverage(values, 7)),
      last: { x: toX(values.length - 1), y: toY(values[values.length - 1]) },
    };
  }, [values]);

  if (!geom) return null;
  return (
    <Svg width={CHART_W} height={CHART_H}>
      {geom.avg ? <Path d={geom.avg} fill="none" stroke={avgColor} strokeWidth={2.5} strokeLinecap="round" /> : null}
      {geom.raw ? (
        <Path d={geom.raw} fill="none" stroke={color} strokeWidth={1.2} opacity={0.55} strokeLinecap="round" />
      ) : null}
      <Circle cx={geom.last.x} cy={geom.last.y} r={3.5} fill={avgColor} />
    </Svg>
  );
}

/**
 * 体重卡（v3 M8）——借「吃一点」的角落小卡：
 * 大数字 + BMI + 迷你趋势（原始点 + 7 日均线）+ 圆形 ⊕ 快捷记录。
 */
export function WeightCard({
  points,
  heightCm,
  busy = false,
  onAdd,
  style,
}: {
  points: WeightPoint[];
  heightCm: number | null;
  busy?: boolean;
  onAdd: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const bmi = latest ? computeBmi(latest.weightKg, heightCm) : null;
  const delta = weightDelta(points);
  const deltaText = weightDeltaText(delta);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.body}>
        <View style={styles.valueRow}>
          {latest ? (
            <AnimatedNumber
              value={latest.weightKg}
              decimals={1}
              style={styles.value}
              accessibilityLabel={`最新体重 ${latest.weightKg} 公斤`}
            />
          ) : (
            <Text style={styles.value}>--</Text>
          )}
          <Text style={styles.unit}>kg</Text>
        </View>
        <Text style={styles.meta}>
          {bmi !== null ? `BMI ${bmi} · ${bmiLabel(bmi)}` : "填身高后显示 BMI"}
          {deltaText ? ` · ${deltaText}` : ""}
        </Text>
        <Text style={styles.hint} numberOfLines={1}>
          {points.length === 0 ? "记录第一次体重，之后能看趋势" : `近 ${points.length} 次记录 · 粗线为 7 日均线`}
        </Text>
      </View>

      <View style={styles.chart}>
        <WeightSparkline
          values={points.map((p) => p.weightKg)}
          color={colors.accent}
          avgColor={colors.accentStrong}
        />
      </View>

      <Pressable
        onPress={() => {
          haptics.light();
          onAdd();
        }}
        disabled={busy}
        style={styles.add}
        accessibilityLabel="记录今日体重"
      >
        <ThemedIcon name="add" size={18} color={colors.success} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 20,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    valueRow: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
    value: { ...typography.title1, fontWeight: "800", fontStyle: "italic", color: colors.text, ...tabularNums },
    unit: { ...typography.micro, color: colors.textMuted, marginBottom: 3 },
    meta: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    hint: { ...typography.micro, fontWeight: "400", color: colors.textFaint },
    chart: { width: CHART_W, height: CHART_H, justifyContent: "center" },
    add: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.successSoft,
    },
  });
