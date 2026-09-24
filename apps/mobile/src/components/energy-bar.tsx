/* eslint-disable react-hooks/immutability -- Reanimated 共享值本就靠赋值驱动（与 learn/today/market 等页同一约定） */
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { ENERGY_LEVELS, energyLevelOf } from "@/lib/energy";
import { useTheme } from "@/theme";
import { haptics } from "@/lib/haptics";
import { radius, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 每天精力状态快捷选取（参考用户给的 reaction-bar 代码，做了移动端适配）：
 * 5 个圆形按钮组成胶囊条，选中项放大 + 主色描边，其余淡化；
 * 参考里是 hover 放大 + tooltip，手机改成"按下放大 + 选中项常驻高亮"。
 * 数据落到既有接口 `/api/wellbeing/energy`（无需新表）。
 */
function EnergyButton({
  level,
  emoji,
  color,
  active,
  dimmed,
  onPress,
}: {
  level: number;
  emoji: string;
  color: string;
  active: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(active ? 1.16 : 1, { damping: 10, stiffness: 220 });
  }, [active, scale]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.btnWrap, anim, { opacity: dimmed ? 0.5 : 1 }]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(1.28, { damping: 11, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(active ? 1.16 : 1, { damping: 10, stiffness: 220 });
        }}
        onPress={() => {
          haptics.light();
          onPress();
        }}
        style={[
          styles.btn,
          active && { borderColor: color, backgroundColor: color + "22" },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`精力 ${level} 档`}
        accessibilityState={{ selected: active }}
      >
        <Text style={styles.emoji}>{emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function EnergyBar({
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
  const current = energyLevelOf(value);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>今天精力怎么样？</Text>
        <Text style={styles.hint}>{busy ? "记录中…" : current ? `已记录 · ${current.label}` : "点一下即可"}</Text>
      </View>
      <View style={styles.bar}>
        {ENERGY_LEVELS.map((e) => (
          <EnergyButton
            key={e.level}
            level={e.level}
            emoji={e.emoji}
            color={e.color}
            active={value === e.level}
            dimmed={value !== null && value !== e.level}
            onPress={() => onSelect(e.level)}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {ENERGY_LEVELS.map((e) => (
          <Text
            key={e.level}
            style={[styles.label, value === e.level && { color: e.color, fontWeight: "800" }]}
            numberOfLines={1}
          >
            {e.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      gap: 10,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { ...typography.callout, fontWeight: "800", color: colors.text },
    hint: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnWrap: { flex: 1, alignItems: "center" },
    btn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      borderWidth: 3,
      borderColor: colors.surface,
    },
    emoji: { fontSize: 22 },
    labels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
    label: { flex: 1, textAlign: "center", ...typography.micro, fontWeight: "600", color: colors.textMuted },
  });
