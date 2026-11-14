import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { CELEBRATION_GIF } from "@/lib/energy-art";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import { shadows, typography } from "@/theme/tokens";

/**
 * 轻量庆祝横幅：用于「读完一节 / 完成一个知识点」这类**不该打断阅读**的时刻。
 *
 * 与全屏 CelebrationModal 的分工：
 * - 全屏弹窗：今日计划完成、408 每日 20 张、一组练习完成（用户已经停下手上的动作）；
 * - 本横幅：读到哪里就完成到哪里（用户还在滚动），所以不设遮罩、不拦触摸、
 *   2.4 秒自动收起，只给「这一节拿下了」的即时反馈。
 */
export function CelebrationBurst({
  visible,
  title,
  subtitle,
  kicker = "本节完成",
  onDone,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** 顶部小字；默认用于「读完一节」 */
  kicker?: string;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  const motionActive = isMotionActive(reduced);
  const appear = useSharedValue(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!visible) {
      appear.value = 0;
      return;
    }
    haptics.success();
    appear.value = motionActive ? withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }) : 1;
    const hold = setTimeout(() => {
      if (motionActive) {
        appear.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) });
        setTimeout(() => onDoneRef.current(), 280);
      } else {
        onDoneRef.current();
      }
    }, 2400);
    return () => clearTimeout(hold);
  }, [visible, appear, motionActive]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 14 }, { scale: 0.96 + appear.value * 0.04 }],
  }));

  const styles = useMemo(() => makeStyles(), []);
  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, cardStyle]} accessibilityLiveRegion="polite">
      <View style={styles.card}>
        <Image
          source={CELEBRATION_GIF}
          style={styles.gif}
          contentFit="contain"
          autoplay={motionActive}
          transition={0}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.body}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 96,
      zIndex: 60,
      alignItems: "center",
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      width: "100%",
      maxWidth: 420,
      paddingVertical: 10,
      paddingLeft: 8,
      paddingRight: 16,
      borderRadius: 20,
      backgroundColor: "rgba(28,20,46,0.95)",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: "rgba(255,255,255,0.14)",
      ...shadows.floating,
    },
    gif: { width: 54, height: 54 },
    body: { flex: 1, gap: 2 },
    kicker: { ...typography.micro, fontWeight: "800", color: "rgba(255,255,255,0.62)", letterSpacing: 1.2 },
    title: { ...typography.body, fontWeight: "800", color: "#FFFFFF" },
    subtitle: { ...typography.caption, color: "rgba(255,255,255,0.68)" },
  });
