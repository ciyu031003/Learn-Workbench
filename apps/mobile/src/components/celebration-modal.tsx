import { useEffect, useMemo, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Celebration } from "@/components/celebration";
import type { CelebrationTone } from "@/lib/celebration-copy";
import { TOTAL_MS } from "@/lib/celebration-particles";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { isMotionActive } from "@/theme/motion";
import { radius, shadows, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 完成每日任务 / 习惯 / 一组练习后的**庆祝弹窗**。
 *
 * ## v1.44 真机反馈修复
 * 用户原话：「弹出以后来回弹动」「烟花效果并不明显，只有几条彩带，彩带也只是几个颜色的矩形」。
 *
 * 1. **不再来回弹动**：旧版入场用 `withSpring(1, { damping: 12, stiffness: 180 })`。
 *    Reanimated 的 `damping` 是**阻尼系数**（与 stiffness/mass 同量纲），不是 iOS 那种 0–1 的
 *    阻尼比；12 对 stiffness 180 来说是明显欠阻尼 → 过冲、回弹、再回弹，就是用户看到的"来回弹动"。
 *    现在改成 `withTiming`（`Easing.out(Easing.back(1.02))` 只给一点点起手过冲，全程 <260ms），
 *    落位后**完全静止**。见 lib/motion.ts 顶部关于量纲陷阱的说明。
 * 2. **弹窗本身不再持续脉动**：旧版两团氛围光斑用 `withRepeat` 无限呼吸，
 *    弹窗"一直在动"的观感有一部分来自它。现在光斑只做一次性淡入，静态铺底。
 * 3. **烟花与彩带**交给重写后的 `<Celebration>`（3 个爆点 + 扩散光环 + 30 条飘落彩带）。
 * 4. **自动关闭跟着特效时长走**：默认 `TOTAL_MS + 1700`，烟花演完后还有约 1.7s 从容阅读；
 *    旧版写死 3.4s，比特效时间轴还短，会在特效没演完时就收掉。
 *
 * 按钮 / 点遮罩 / 自动关闭三条退出路径保持不变。
 */
export function CelebrationModal({
  visible,
  onClose,
  title,
  subtitle,
  badge,
  /**
   * 自动关闭时长。默认 = 特效时间轴 + 1.7s 余量：让用户至少完整看完一遍烟花，
   * 又不至于为了关它而等太久（点遮罩/按钮随时可关）。
   * 直接引用 TOTAL_MS 而不是写死数字 —— 改特效时长时这里自动跟随。
   */
  autoCloseMs = TOTAL_MS + 1700,
  tone,
}: {
  visible: boolean;
  onClose: () => void;
  /** 完成对象名（任务标题 / 习惯名 / 练习名） */
  title: string;
  subtitle?: string;
  /** 圆形徽章里的文字，如 "100%" 或 "✓" */
  badge?: string;
  autoCloseMs?: number;
  /** 按正确率分档的文案与配色（不传则用中性默认） */
  tone?: CelebrationTone;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduced = useReducedMotion();
  const motionActive = isMotionActive(reduced);

  const appear = useSharedValue(0);
  /**
   * v19-S4：onClose 存 ref 再消费 —— 调用方传的常是内联箭头函数，
   * 父级任何 re-render 都会换一个引用；此前它直接躺在 effect 依赖里，
   * 每次父渲染都会清掉再重设自关计时（表现：弹窗"迟迟不自动关"）。
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      appear.value = 0;
      return;
    }
    haptics.success();
    if (motionActive) {
      /**
       * 一次性淡入 + 轻微上浮，落位即静止。
       * `Easing.back(1.02)` 的过冲幅度 ≈ 2%，肉眼只当作"弹了一下"，不会有第二次回弹。
       */
      appear.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.02)) });
    } else {
      appear.value = 1;
    }
    const t = setTimeout(() => onCloseRef.current(), autoCloseMs);
    return () => clearTimeout(t);
  }, [visible, appear, autoCloseMs, motionActive]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.94 + appear.value * 0.06 }, { translateY: (1 - appear.value) * 18 }],
  }));
  /** 光斑：只淡入，不脉动（"来回弹动"的另一半来源） */
  const glowStyle = useAnimatedStyle(() => ({ opacity: appear.value * 0.85 }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(1 - appear.value) * -14}deg` }, { scale: 0.7 + appear.value * 0.3 }],
  }));
  /** 顶部四条放射光线：一次性展开，给"庆祝"一个明确的起手 */
  const raysStyle = useAnimatedStyle(() => ({
    opacity: appear.value * 0.5,
    transform: [{ scale: 0.6 + appear.value * 0.4 }],
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="关闭庆祝弹窗">
        <Celebration play={visible} />
        <Animated.View style={[styles.card, cardStyle, tone ? { backgroundColor: tone.cardColor } : null]}>
          {/* 氛围光斑（模拟渐变）：静态铺底，不呼吸 */}
          <Animated.View
            pointerEvents="none"
            style={[styles.glow, styles.glowA, glowStyle, tone ? { backgroundColor: tone.glowA } : null]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.glow, styles.glowB, glowStyle, tone ? { backgroundColor: tone.glowB } : null]}
          />
          {/* 放射光线 */}
          <Animated.View pointerEvents="none" style={[styles.rays, raysStyle]}>
            {[0, 45, 90, 135].map((deg) => (
              <View key={deg} style={[styles.ray, { transform: [{ rotate: `${deg}deg` }] }]} />
            ))}
          </Animated.View>

          <Text style={styles.kicker}>{tone?.kicker ?? "恭喜完成"}</Text>
          <Animated.View style={[styles.badge, badgeStyle, tone ? { backgroundColor: tone.badgeColor } : null]}>
            {badge ? (
              <Text style={styles.badgeText}>{badge}</Text>
            ) : (
              /* v1.44.2 去 emoji：原来兜底是一个 "✓" 字符，改成图标 */
              <ThemedIcon name="checkmark" size={30} color="#FFFFFF" />
            )}
          </Animated.View>
          <Text style={styles.resultLabel}>{tone?.resultLabel ?? "又向前一步"}</Text>

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
            <Text style={styles.btnText}>{tone?.buttonText ?? "继续加油"}</Text>
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
    /** 顶部放射光线容器：锚在徽章上方居中 */
    rays: {
      position: "absolute",
      top: 40,
      left: "50%",
      width: 260,
      height: 260,
      marginLeft: -130,
      alignItems: "center",
      justifyContent: "center",
    },
    ray: {
      position: "absolute",
      width: 3,
      height: 210,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.5)",
    },
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
