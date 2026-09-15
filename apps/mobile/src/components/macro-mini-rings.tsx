import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ProgressArc } from "@/components/progress-arc";
import { macroStatus, withinRange, type NutritionRange } from "@learn-workbench/shared";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

export interface MacroRingItem {
  key: string;
  /** 蛋白 / 碳水 / 脂肪 */
  label: string;
  value: number;
  /** 环的满值（区间中值；不传则用 range.max） */
  target: number;
  /** 区间目标（D3） */
  range?: NutritionRange;
  color: string;
}

/**
 * 三大营养素微环（v3 M5）
 *
 * 借 MacroFactor 的「区间目标」：环以区间中值为满，**落在区间内即达标绿**，
 * 超出上沿才转 danger（提示而非责备）。
 */
export function MacroMiniRings({
  items,
  size = 72,
  strokeWidth = 8,
  style,
}: {
  items: MacroRingItem[];
  size?: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.row, style]}>
      {items.map((it) => {
        const range = it.range;
        const status = range ? macroStatus(it.value, range) : it.value >= it.target ? "in" : "under";
        const done = range ? withinRange(it.value, range) : it.value >= it.target;
        const over = status === "over";
        const full = it.target > 0 ? Math.min(1, it.value / it.target) : 0;
        const arcColor = over ? colors.danger : done ? colors.success : it.color;
        return (
          <View key={it.key} style={styles.cell}>
            <ProgressArc
              progress={full}
              size={size}
              strokeWidth={strokeWidth}
              from={arcColor}
              to={arcColor}
              showDot={false}
              overBudget={over}
              value={Math.round(it.value)}
            />
            <Text style={styles.label}>{it.label}</Text>
            <Text style={[styles.meta, done && styles.metaDone, over && styles.metaOver]}>
              {range ? `${range.min}–${range.max}g` : `${Math.round(it.target)}g`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    cell: { flex: 1, alignItems: "center", gap: 4 },
    label: { ...typography.caption, fontWeight: "700", color: colors.text },
    meta: { ...typography.micro, fontSize: 10, color: colors.textMuted, ...tabularNums },
    metaDone: { color: colors.success },
    metaOver: { color: colors.danger },
  });
