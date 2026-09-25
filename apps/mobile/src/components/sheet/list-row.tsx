import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AnimatedCheckMark } from "@/components/check-mark";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * v16 弹层可选项行（uiverse P6-2 的"描边绘制勾选"）：
 * 勾选框用 `AnimatedCheckMark` 逐帧描边，选中行整行抬底色；
 * 招花筛选、阶段选择、我的求职阶段都用它，替代裸 Pressable。
 */
export function SheetListRow({
  title,
  subtitle,
  icon,
  iconColor,
  selected = false,
  onPress,
  mode = "check",
  trailing,
  disabled = false,
  last = false,
}: {
  title: string;
  subtitle?: string;
  icon?: Parameters<typeof ThemedIcon>[0]["name"];
  iconColor?: string;
  selected?: boolean;
  onPress?: () => void;
  /** check=多选方框；radio=单选圆点；none=纯行（右侧给箭头） */
  mode?: "check" | "radio" | "none";
  trailing?: React.ReactNode;
  disabled?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tint = iconColor ?? colors.primary;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptics.light();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole={mode === "radio" ? "radio" : "checkbox"}
      accessibilityState={{ selected, disabled }}
      style={[styles.row, selected && styles.rowActive, !last && styles.divided, disabled && styles.disabled]}
    >
      {icon ? (
        <View style={[styles.icon, { backgroundColor: tint + "1F" }]}>
          <ThemedIcon name={icon} size={17} color={tint} />
        </View>
      ) : null}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>

      {trailing}

      {mode === "check" ? (
        <View style={[styles.box, selected && styles.boxActive]}>
          <AnimatedCheckMark checked={selected} size={13} color={colors.canvas} />
        </View>
      ) : mode === "radio" ? (
        <View style={[styles.radio, selected && styles.radioActive]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      ) : (
        <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
      )}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: radius.md,
    },
    rowActive: { backgroundColor: colors.primarySoft },
    divided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    disabled: { opacity: 0.5 },
    icon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    body: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.callout, fontWeight: "700", color: colors.text },
    subtitle: { ...typography.micro, color: colors.textMuted },
    box: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    boxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  });
