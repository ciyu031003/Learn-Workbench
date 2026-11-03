import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { ENERGY_LEVELS } from "@/lib/energy";
import { useTheme } from "@/theme";
import { haptics } from "@/lib/haptics";
import { radius, shadows, typography, type ThemeColors } from "@/theme/tokens";

/**
 * v2 状态选择（接现有精力数据 /api/wellbeing/energy，5 档 1-5）。
 * 原型里是 4 档情绪；这里保留数据模型真实档位，视觉按原型做成"圆形图标 + 文字"。
 */
export function MoodPicker({
  value,
  onSelect,
  busy = false,
}: {
  value: number | null;
  onSelect: (level: number) => void;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const active = value === null ? null : ENERGY_LEVELS.find((e) => e.level === value) ?? null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>今天的状态</Text>
        <Text style={styles.hint}>{busy ? "记录中…" : active ? "已记录 · " + active.label : "点一下即可记录"}</Text>
      </View>
      <View style={styles.row}>
        {ENERGY_LEVELS.map((item) => {
          const selected = value === item.level;
          return (
            <Pressable
              key={item.level}
              onPress={() => { haptics.light(); onSelect(item.level); }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={"状态 " + item.label}
              style={[styles.option, selected && { backgroundColor: item.color + "1F" }]}
            >
              <View style={[styles.circle, selected && { borderColor: item.color, backgroundColor: colors.surfaceStrong }]}>
                <ThemedIcon name={item.icon as never} size={20} color={selected ? item.color : colors.textFaint} />
              </View>
              <Text style={[styles.label, selected && { color: item.color, fontWeight: "700" }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 16,
      gap: 12,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { ...typography.callout, fontWeight: "700", color: colors.text },
    hint: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
    option: { flex: 1, minHeight: 68, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: radius.control },
    circle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted, borderWidth: 1.5, borderColor: "transparent" },
    label: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
  });
