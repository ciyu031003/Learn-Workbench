import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";

export interface SegmentOption<T extends string = string> {
  key: T;
  label: string;
  icon?: Parameters<typeof ThemedIcon>[0]["name"];
}

/**
 * v16 分段切换（uiverse P6-1 的"滑动指示"技法）：
 * 选中项不是换色，而是一枚**会滑过去的胶囊**（left 百分比 + withTiming），
 * 落地在弹层头部的 segmented 槽位里，替换此前 4 套各写一遍的分段实现。
 */
export function SheetSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const count = Math.max(1, options.length);
  const pos = useSharedValue(index);

  useEffect(() => {
    pos.value = withTiming(index, { duration: 220 });
  }, [index, pos]);

  const indicator = useAnimatedStyle(() => ({
    left: `${(pos.value * 100) / count}%`,
  }));

  return (
    <View style={styles.track}>
      <Animated.View pointerEvents="none" style={[styles.indicator, { width: `${100 / count}%` }, indicator]} />
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={styles.cell}
            onPress={() => {
              if (active) return;
              haptics.soft();
              onChange(o.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {o.icon ? (
              <ThemedIcon name={o.icon} size={16} color={active ? colors.primaryStrong : colors.textMuted} />
            ) : null}
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    track: {
      flexDirection: "row",
      padding: 4,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    indicator: {
      position: "absolute",
      top: 4,
      bottom: 4,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    cell: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 999,
    },
    label: { ...typography.callout, fontWeight: "700", color: colors.textMuted },
    labelActive: { color: colors.primaryStrong },
  });
