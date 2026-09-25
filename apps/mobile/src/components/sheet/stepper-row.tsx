import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * v16 步进行（时长 / 组次 / 重量）：左标签、右 ± 与数值。
 * 触控目标 ≥44，长按不加速（避免误触），越界自动禁用（uiverse P6-7 的提示语言）。
 */
export function StepperRow({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  hint?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const atMin = value <= min;
  const atMax = value >= max;

  const bump = (delta: number) => {
    const next = clamp(value + delta);
    if (next === value) return;
    haptics.light();
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.control}>
        <Pressable
          onPress={() => bump(-step)}
          disabled={atMin}
          style={[styles.btn, atMin && styles.btnOff]}
          accessibilityLabel={`${label} 减少 ${step}`}
        >
          <ThemedIcon name="remove" size={17} color={atMin ? colors.textFaint : colors.text} />
        </Pressable>
        <View style={styles.valueWrap}>
          <Text style={styles.value}>{value}</Text>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>
        <Pressable
          onPress={() => bump(step)}
          disabled={atMax}
          style={[styles.btn, atMax && styles.btnOff]}
          accessibilityLabel={`${label} 增加 ${step}`}
        >
          <ThemedIcon name="add" size={17} color={atMax ? colors.textFaint : colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    text: { flex: 1, minWidth: 0, gap: 2 },
    label: { ...typography.callout, fontWeight: "700", color: colors.text },
    hint: { ...typography.micro, color: colors.textMuted },
    control: { flexDirection: "row", alignItems: "center", gap: 10 },
    btn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnOff: { opacity: 0.45 },
    valueWrap: { minWidth: 62, flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 2 },
    value: { ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    unit: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
  });
