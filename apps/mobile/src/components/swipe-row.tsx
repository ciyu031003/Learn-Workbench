import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { typography } from "@/theme/tokens";
import { useTheme } from "@/theme";

const ACTION_WIDTH = 88;

function RightAction({
  progress,
  label,
  onPress,
  color,
  bg,
}: {
  progress: SharedValue<number>;
  label: string;
  onPress: () => void;
  color: string;
  bg: string;
}) {
  // 用 progress 驱动出现过程（淡入 + 轻微右移），避免面板突然弹出
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    return { opacity: p, transform: [{ translateX: (1 - p) * 12 }] };
  });
  return (
    <Animated.View style={style}>
      <Pressable
        style={[styles.action, { backgroundColor: bg }]}
        onPress={() => {
          haptics.warning();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <ThemedIcon name="trash-outline" size={18} color={color} />
        <Text style={[styles.actionText, { color }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * 左滑删除行（v3 M3）
 *
 * 用 RNGH 2.32 自带的 `ReanimatedSwipeable`（零新增依赖），滑出露出 88pt 删除钮；
 * 删除后由父级做 `LinearTransition` 高度塌陷。
 */
export function SwipeRow({
  children,
  onDelete,
  deleteLabel = "删除",
  enabled = true,
  style,
}: {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <ReanimatedSwipeable
      enabled={enabled}
      friction={1.6}
      rightThreshold={36}
      overshootRight={false}
      containerStyle={[styles.container, style]}
      childrenContainerStyle={styles.children}
      renderRightActions={(progress) => (
        <RightAction
          progress={progress}
          label={deleteLabel}
          onPress={onDelete}
          color={colors.danger}
          bg={colors.dangerSoft}
        />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "transparent" },
  children: { backgroundColor: "transparent" },
  action: {
    width: ACTION_WIDTH,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 14,
    marginLeft: 8,
  },
  actionText: { ...typography.micro, fontWeight: "800" },
});

/** 供外部布局参考（与 renderRightActions 宽度一致） */
export const SWIPE_ACTION_WIDTH = ACTION_WIDTH;
