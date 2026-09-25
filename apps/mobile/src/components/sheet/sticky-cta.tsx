import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, typography, type ThemeColors } from "@/theme/tokens";

/**
 * v16 吸底 CTA（uiverse P6-4）：弹层里唯一的"启动/提交"按钮。
 * 与"选择 ≠ 启动"的不变量配套 —— 弹层内所有点选都只改选择态，只有这里会真正动作。
 */
export function SheetStickyCta({
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  danger = false,
  secondaryLabel,
  onSecondary,
}: {
  label: string;
  onPress: () => void;
  icon?: Parameters<typeof ThemedIcon>[0]["name"];
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bg = danger ? colors.danger : colors.primary;
  const off = disabled || loading;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          if (off) return;
          haptics.light();
          onPress();
        }}
        disabled={off}
        accessibilityRole="button"
        accessibilityState={{ disabled: off, busy: loading }}
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: bg, opacity: off ? 0.55 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.canvas} />
        ) : icon ? (
          <ThemedIcon name={icon} size={17} color={colors.canvas} />
        ) : null}
        <Text style={styles.primaryText} numberOfLines={1}>{label}</Text>
      </Pressable>

      {secondaryLabel && onSecondary ? (
        <Pressable
          onPress={() => {
            haptics.soft();
            onSecondary();
          }}
          accessibilityRole="button"
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    primary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 50,
      borderRadius: radius.lg,
      paddingHorizontal: 18,
    },
    primaryText: { ...typography.body, fontWeight: "800", color: colors.canvas },
    secondary: { alignItems: "center", paddingVertical: 8 },
    secondaryText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
  });
