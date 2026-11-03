import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { deltaDirection, deltaTone, formatDelta, withAlpha } from "@/lib/chart-math";

/** 主值/强调色（全部映射到 theme token，禁止裸色值） */
export type StatTone = "text" | "primary" | "success" | "warning" | "accent" | "danger" | "teal";

const TONE_KEY: Record<StatTone, keyof ThemeColors> = {
  text: "text",
  primary: "primary",
  success: "success",
  warning: "warning",
  accent: "accent",
  danger: "danger",
  teal: "teal",
};

/** 变动胶囊：正数向上、负数向下；`invert` 用于"降才是好"的反向指标 */
export interface StatDelta {
  /** 变动值（同单位），0 视为持平 */
  value: number;
  /** 后缀，默认 "%" */
  suffix?: string;
  /** 反向指标：体脂率 / 耗时 / 错误率 —— 下降用 success 色 */
  invert?: boolean;
  /** 覆盖自动色调（如"持平"也想标灰以外的颜色） */
  tone?: StatTone;
}

export interface StatTileProps {
  label: string;
  value: string | number;
  /** 主值单位（小字紧跟主值） */
  unit?: string;
  /** 主值颜色，默认正文色 */
  tone?: StatTone;
  delta?: StatDelta;
  /** 标签下方的补充说明（比 label 更弱） */
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

/**
 * v2 指标卡（BoardUI 仪表盘的 3-4 格指标行里的一格）：
 * 白卡 + 细描边 + 轻投影，主值用 `typography.num` + tabular-nums（多格纵向对齐），
 * 单位小字跟在主值基线上，底部可选升降胶囊。
 */
export function StatTile({ label, value, unit, tone = "text", delta, hint, icon, style }: StatTileProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const valueColor = (colors[TONE_KEY[tone]] as string | undefined) ?? colors.text;
  const deltaKind = delta ? deltaTone(delta.value, delta.invert) : "muted";
  const deltaColor =
    delta?.tone
      ? ((colors[TONE_KEY[delta.tone]] as string | undefined) ?? colors.textMuted)
      : deltaKind === "success"
        ? colors.success
        : deltaKind === "danger"
          ? colors.danger
          : colors.textMuted;
  const deltaBg =
    delta?.tone
      ? withAlpha(deltaColor, 0.12)
      : deltaKind === "success"
        ? colors.successSoft
        : deltaKind === "danger"
          ? colors.dangerSoft
          : colors.surfaceMuted;
  const direction = delta ? deltaDirection(delta.value) : "flat";

  return (
    <View
      style={[styles.card, style]}
      accessibilityLabel={[label, value, unit, delta ? formatDelta(delta.value, delta.suffix) : null]
        .filter(Boolean)
        .join(" ")}
    >
      <View style={styles.top}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {icon ? <ThemedIcon name={icon} size={14} color={colors.textFaint} /> : null}
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, tabularNums, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
        {unit ? (
          <Text style={styles.unit} numberOfLines={1}>
            {unit}
          </Text>
        ) : null}
      </View>

      {delta ? (
        <View style={[styles.deltaPill, { backgroundColor: deltaBg }]}>
          {direction !== "flat" ? (
            <ThemedIcon name={direction === "up" ? "chevron-up" : "chevron-down"} size={11} color={deltaColor} />
          ) : null}
          <Text style={[styles.deltaText, { color: deltaColor }]} numberOfLines={1}>
            {formatDelta(delta.value, delta.suffix)}
          </Text>
        </View>
      ) : null}

      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * 一行 3-4 个指标卡（等宽 flex）。
 * `columns` 只做"最多显示几格"，不会补空卡；窄屏下卡片靠 numberOfLines + adjustsFontSizeToFit 收敛。
 */
export function StatTileRow({
  items,
  columns,
  gap = spacing.sm,
  style,
}: {
  items: StatTileProps[];
  columns?: 3 | 4;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const list = items.slice(0, columns ?? Math.min(4, Math.max(1, items.length)));
  if (list.length === 0) return null;
  return (
    <View style={[styles.row, { gap }, style]}>
      {list.map((item, index) => (
        <StatTile key={`${item.label}-${index}`} {...item} />
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      gap: 5,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
    label: { ...typography.meta, color: colors.textMuted, flexShrink: 1 },
    valueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
    value: { ...typography.num },
    unit: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    deltaPill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    deltaText: { ...typography.caption, fontWeight: "700" },
    hint: { ...typography.caption, fontWeight: "400", color: colors.textFaint },
    row: { flexDirection: "row", alignItems: "stretch" },
  });
