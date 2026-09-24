import { useEffect, useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Celebration } from "@/components/celebration";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, shadows, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 完成每日任务 / 习惯后的**庆祝弹窗**（参考用户给的 results-summary + confetti 代码）。
 *
 * RN 没有 CSS 渐变，这里用「深紫底 + 两团缓慢脉动的彩色光斑」做出同款氛围，
 * 叠加 `Celebration` 的放射彩带 + 顶部渐显的圆形结果徽章；
 * 按钮 / 点遮罩 / 3.4s 自动关闭三条退出路径。
 */
export function CelebrationModal({
  visible,
  onClose,
  title,
  subtitle,
  badge,
  autoCloseMs = 3400,
}: {
  visible: boolean;
  onClose: () => void;
  /** 完成对象名（任务标题 / 习惯名） */
  title: string;
  subtitle?: string;
  /** 圆形徽章里的文字，如 "100%" 或 "✓" */
  badge?: string;
  autoCloseMs?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const appear = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      appear.value = 0;
      return;
    }
    haptics.success();
    appear.value = withSpring(1, { damping: 12, stiffness: 180 });
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [visible, appear, pulse, onClose, autoCloseMs]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.9 + appear.value * 0.1 }, { translateY: (1 - appear.value) * 22 }],
  }));
  const glowA = useAnimatedStyle(() => ({
    opacity: 0.32 + pulse.value * 0.26,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));
  const glowB = useAnimatedStyle(() => ({
    opacity: 0.28 + (1 - pulse.value) * 0.24,
    transform: [{ scale: 1 + (1 - pulse.value) * 0.1 }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(1 - appear.value) * -18}deg` }, { scale: appear.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="关闭庆祝弹窗">
        <Celebration play={visible} />
        <Animated.View style={[styles.card, cardStyle]}>
          {/* 氛围光斑（模拟渐变） */}
          <Animated.View pointerEvents="none" style={[styles.glow, styles.glowA, glowA]} />
          <Animated.View pointerEvents="none" style={[styles.glow, styles.glowB, glowB]} />

          <Text style={styles.kicker}>恭喜完成</Text>
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{badge ?? "✓"}</Text>
          </Animated.View>
          <Text style={styles.resultLabel}>又向前一步</Text>

          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}

          <Pressable
            style={styles.btn}
            onPress={() => {
              haptics.light();
              onClose();
            }}
            accessibilityRole="button"
          >
            <ThemedIcon name="sparkles" size={16} color="#fff" />
            <Text style={styles.btnText}>继续加油</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(10,6,20,0.62)",
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
    },
    card: {
      width: "100%",
      maxWidth: 330,
      borderRadius: 30,
      paddingVertical: 26,
      paddingHorizontal: 22,
      alignItems: "center",
      backgroundColor: "#3A2150",
      overflow: "hidden",
      ...shadows.floating,
    },
    glow: { position: "absolute", borderRadius: 999 },
    glowA: { width: 240, height: 240, top: -110, right: -80, backgroundColor: "#dd5e89" },
    glowB: { width: 260, height: 260, bottom: -140, left: -90, backgroundColor: "#ef629f" },
    kicker: { ...typography.micro, fontWeight: "800", color: "rgba(255,255,255,0.72)", letterSpacing: 2 },
    badge: {
      width: 132,
      height: 132,
      borderRadius: 66,
      marginTop: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(86,171,47,0.92)",
      borderWidth: 4,
      borderColor: "rgba(255,255,255,0.28)",
    },
    badgeText: { fontSize: 40, fontWeight: "900", color: "#fff", ...tabularNums },
    resultLabel: { marginTop: 14, ...typography.callout, fontWeight: "700", color: "rgba(255,255,255,0.82)" },
    title: {
      marginTop: 10,
      ...typography.title2,
      fontWeight: "900",
      color: "#fff",
      textAlign: "center",
    },
    subtitle: { marginTop: 6, ...typography.caption, color: "rgba(255,255,255,0.7)", textAlign: "center" },
    btn: {
      marginTop: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 30,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    btnText: { ...typography.body, fontWeight: "900", color: "#fff", letterSpacing: 0.6 },
  });
