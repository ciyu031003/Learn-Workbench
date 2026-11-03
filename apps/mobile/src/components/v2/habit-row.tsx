/* eslint-disable react-hooks/immutability -- Reanimated 共享值本就在 effect 里赋值（与 energy-bar / bottom-sheet 同一约定） */
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * v2 习惯行：图标芯片 + 标题/说明 + 连续天数 + 圆形勾选。
 * 命中区整行（minHeight 66）；勾选态用 success 底 + 删除线文案。
 * 勾选时对勾做一次弹簧缩放入场（减弱动态/关闭动效时直接到终态）。
 */
export function HabitRow({
  icon = "checkmark-circle-outline",
  title,
  subtitle,
  streak,
  done,
  onToggle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  streak?: number;
  done: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduced = useReducedMotion();
  const active = isMotionActive(reduced);
  const checkScale = useSharedValue(1);

  useEffect(() => {
    if (!done) {
      checkScale.value = 1;
      return;
    }
    // worklet 内只调用 Reanimated API；不许外部普通函数
    checkScale.value = active ? withSpring(1, { damping: 12, stiffness: 260 }) : 1;
  }, [active, done, checkScale]);

  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  // 入场（勾选出现）时从 0.6 弹到 1：共用同一个共享值，避免第二个动效点
  useEffect(() => {
    if (!done) return;
    checkScale.value = active ? 0.6 : 1;
    checkScale.value = active ? withSpring(1, { damping: 12, stiffness: 260 }) : 1;
  }, [active, done, checkScale]);

  return (
    <Pressable
      onPress={() => { haptics.light(); onToggle(); }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={title + (done ? "，已完成" : "，未完成")}
      style={({ pressed }) => [styles.row, done && styles.rowDone, pressed && styles.pressed]}
    >
      <View style={[styles.iconChip, done && styles.iconChipDone]}>
        <ThemedIcon name={icon} size={18} color={done ? colors.success : colors.primary} />
      </View>
      <View style={styles.mid}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {typeof streak === "number" && streak > 0 ? (
        <Text style={styles.streak}>{streak} 天</Text>
      ) : null}
      <Animated.View style={[styles.check, done && styles.checkDone, checkStyle]}>
        {done ? <ThemedIcon name="checkmark" size={14} color="#FFFFFF" /> : null}
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 66,
      paddingVertical: spacing.sm,
      paddingHorizontal: 3,
      borderRadius: radius.control,
    },
    rowDone: { backgroundColor: colors.successSoft, paddingHorizontal: spacing.sm },
    pressed: { opacity: 0.75 },
    iconChip: { width: 38, height: 38, borderRadius: radius.control - 1, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
    iconChipDone: { backgroundColor: colors.surfaceStrong },
    mid: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.callout, fontWeight: "600", color: colors.text },
    titleDone: { color: colors.textFaint, textDecorationLine: "line-through" },
    subtitle: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    streak: { ...typography.caption, fontWeight: "700", color: colors.warning },
    check: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  });
