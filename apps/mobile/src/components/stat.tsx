import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 记分牌式数字（见 docs/APP端优化方案-v2 §1.5.3C —— Orbix Pulse 手法）
 * 数字 28·800 + `tabular-nums` + 字距 -0.5；标签 11·600 muted，紧跟数字右下 2pt。
 * 深色下加极淡内阴影，模拟点阵屏质感。
 */
export function Stat({
  value,
  unit,
  label,
  color,
  size = 28,
  style,
}: {
  value: string | number;
  unit?: string;
  label?: string;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.stat, style]}>
      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            { fontSize: size, lineHeight: Math.round(size * 1.16), color: color ?? colors.text },
            dark && styles.valueDark,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {label ? <Text style={styles.label} numberOfLines={1}>{label}</Text> : null}
    </View>
  );
}

/**
 * 一行最多 3 个 Stat，hairline 竖线分隔（参考 Orbix Pulse）。
 * 超过 3 个请拆成两行 —— 这是「一处看全但每处只留核心指标」的硬约束。
 */
export function StatRow({
  items,
  dividers = true,
  style,
}: {
  items: { key: string; value: string | number; unit?: string; label?: string; color?: string }[];
  dividers?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shown = items.slice(0, 3);
  return (
    <View style={[styles.row, style]}>
      {shown.map((it, i) => (
        <View key={it.key} style={styles.cellWrap}>
          {i > 0 && dividers ? <View style={styles.divider} /> : null}
          <Stat value={it.value} unit={it.unit} label={it.label} color={it.color} style={styles.cell} />
        </View>
      ))}
    </View>
  );
}

/** 键值对行（明细用，如「目标 / 已完成」） */
export function StatLine({
  label,
  value,
  valueColor,
  style,
}: {
  label: string;
  value: string;
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.line, style]}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

/** 横条进度（明细/次级用；首屏重点位置改用 ProgressArc） */
export function ProgressBar({
  progress,
  color,
  height = 8,
  style,
}: {
  progress: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.bar, { height, borderRadius: height / 2 }, style]}>
      <View
        style={{
          width: `${clamped * 100}%`,
          height: "100%",
          borderRadius: height / 2,
          backgroundColor: color ?? colors.primary,
        }}
      />
    </View>
  );
}

export function StatHint({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={[styles.hint, style]}>{children}</Text>;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stat: { gap: 2 },
    valueRow: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
    value: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, color: colors.text, ...tabularNums },
    valueDark: {
      textShadowColor: "rgba(0,0,0,0.45)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    },
    unit: { ...typography.micro, color: colors.textMuted, marginBottom: 3 },
    label: { ...typography.micro, color: colors.textMuted },
    row: { flexDirection: "row", alignItems: "stretch" },
    cellWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
    cell: { flex: 1, paddingHorizontal: 10 },
    divider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.border },
    line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    lineLabel: { ...typography.callout, color: colors.textMuted },
    lineValue: { ...typography.callout, fontWeight: "700", color: colors.text },
    bar: { backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    hint: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
  });
