import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { DURATION, useReducedMotion } from "@/lib/motion";

/**
 * 折叠区（P1 · 首页「5 必见 + 2 折叠」的折叠载体）。
 *
 * 为什么不做成通用手风琴：折叠的目的是**首屏减负 + 重内容懒加载**，
 * 不是交互玩具。因此：默认收起；首次展开后才挂载 children（图表/曲线不参与首屏渲染）；
 * 收起后保留已挂载状态（再次展开零延迟），只有 chevron 做 150ms 旋转。
 *
 * 无动画降级：系统「减弱动态」或用户关闭动效时，chevron 直接落终值。
 */
export function CollapsibleSection({
  title,
  meta,
  defaultOpen = false,
  children,
  style,
  testID,
}: {
  title: string;
  /** 右侧摘要（如「本周 +12%」「3 项」），收起时也要能看到结论 */
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  /** 首次展开后才挂载内容；一旦挂载就保持（收起时不销毁，避免重渲染抖动） */
  const [mounted, setMounted] = useState(defaultOpen);
  const rotation = useSharedValue(defaultOpen ? 1 : 0);

  const toggle = useCallback(() => {
    haptics.light();
    setOpen((prev) => {
      const next = !prev;
      if (next) setMounted(true);
      rotation.value = reduced
        ? next
          ? 1
          : 0
        : withTiming(next ? 1 : 0, { duration: DURATION.fast });
      return next;
    });
  }, [reduced, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: rotation.value * 180 + "deg" }],
  }));

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? `收起${title}` : `展开${title}`}
        onPress={toggle}
        style={({ pressed }) => [styles.head, pressed && styles.headPressed]}
      >
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={styles.right}>
          {meta ? (
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Animated.View>
        </View>
      </Pressable>
      {mounted ? (
        <View style={open ? styles.body : styles.bodyHidden} pointerEvents={open ? "auto" : "none"}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.xs },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.control,
    },
    headPressed: { opacity: 0.7 },
    title: { ...typography.section },
    right: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 },
    meta: { ...typography.meta },
    body: { gap: spacing.md },
    bodyHidden: { height: 0, overflow: "hidden" },
  });
